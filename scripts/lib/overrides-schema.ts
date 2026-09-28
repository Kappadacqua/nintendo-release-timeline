/**
 * Validation of data/overrides.json, used by the admin endpoint before every save
 * (ITERATION-3 §2). Plain checks, no dependencies: returns human-readable errors.
 */

type Json = unknown;

const isObject = (v: Json): v is Record<string, Json> => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: Json) => Number.isInteger(v);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^(igdb:\d+|manual:[a-z0-9-]+)$/;

const GAME_KEYS = new Set([
  "_title",
  "include",
  "exclusivity",
  "alsoOnSwitch1",
  "developer",
  "opencriticId",
  "metacritic",
  "backloggd",
  "links",
  "releaseDates",
]);
const LINK_KEYS = new Set(["opencritic", "metacritic", "backloggd", "wikipedia", "nintendoWiki", "nintendoStore"]);

function number(errors: string[], where: string, v: Json, min: number, max: number, integer = false) {
  if (v === undefined) return;
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (integer && !isInt(v))) {
    errors.push(`${where}: expected ${integer ? "an integer" : "a number"} between ${min} and ${max}, got ${JSON.stringify(v)}`);
  }
}

function url(errors: string[], where: string, v: Json) {
  if (typeof v !== "string" || !/^https?:\/\/\S+$/.test(v)) errors.push(`${where}: expected an http(s) URL`);
}

export function validateGameOverride(id: string, o: Json): string[] {
  const errors: string[] = [];
  const at = (k: string) => `games["${id}"].${k}`;
  if (!ID.test(id)) errors.push(`games: bad id "${id}" (expected igdb:<number> or manual:<slug>)`);
  if (!isObject(o)) return [...errors, `games["${id}"]: expected an object`];

  for (const key of Object.keys(o)) if (!GAME_KEYS.has(key)) errors.push(`${at(key)}: unknown field`);
  if (o._title !== undefined && typeof o._title !== "string") errors.push(`${at("_title")}: expected text`);
  if (o.include !== undefined && typeof o.include !== "boolean") errors.push(`${at("include")}: expected true or false`);
  if (o.alsoOnSwitch1 !== undefined && typeof o.alsoOnSwitch1 !== "boolean") errors.push(`${at("alsoOnSwitch1")}: expected true or false`);
  if (o.developer !== undefined && !(typeof o.developer === "string" && o.developer.trim())) errors.push(`${at("developer")}: expected a studio name`);
  if (o.exclusivity !== undefined && !["exclusive", "timed", null].includes(o.exclusivity as string | null)) {
    errors.push(`${at("exclusivity")}: expected "exclusive", "timed" or null`);
  }
  number(errors, at("opencriticId"), o.opencriticId, 1, Number.MAX_SAFE_INTEGER, true);

  if (o.metacritic !== undefined) {
    if (!isObject(o.metacritic)) errors.push(`${at("metacritic")}: expected an object`);
    else {
      for (const key of Object.keys(o.metacritic)) {
        if (!["critic", "criticCount", "user", "userCount"].includes(key)) errors.push(`${at(`metacritic.${key}`)}: unknown field`);
      }
      number(errors, at("metacritic.critic"), o.metacritic.critic, 0, 100, true);
      number(errors, at("metacritic.criticCount"), o.metacritic.criticCount, 0, 1e7, true);
      number(errors, at("metacritic.user"), o.metacritic.user, 0, 10);
      number(errors, at("metacritic.userCount"), o.metacritic.userCount, 0, 1e9, true);
    }
  }
  if (o.backloggd !== undefined) {
    if (!isObject(o.backloggd)) errors.push(`${at("backloggd")}: expected an object`);
    else {
      for (const key of Object.keys(o.backloggd)) {
        if (!["rating", "count"].includes(key)) errors.push(`${at(`backloggd.${key}`)}: unknown field`);
      }
      number(errors, at("backloggd.rating"), o.backloggd.rating, 0, 5);
      number(errors, at("backloggd.count"), o.backloggd.count, 0, 1e9, true);
    }
  }
  if (o.links !== undefined) {
    if (!isObject(o.links)) errors.push(`${at("links")}: expected an object`);
    else {
      for (const [key, value] of Object.entries(o.links)) {
        if (!LINK_KEYS.has(key)) errors.push(`${at(`links.${key}`)}: unknown link`);
        else url(errors, at(`links.${key}`), value);
      }
    }
  }
  if (o.releaseDates !== undefined) {
    if (!isObject(o.releaseDates)) errors.push(`${at("releaseDates")}: expected an object`);
    else {
      for (const [key, value] of Object.entries(o.releaseDates)) {
        if (!["JP", "EU", "NA"].includes(key)) errors.push(`${at(`releaseDates.${key}`)}: expected JP, EU or NA`);
        else if (value !== null && !(typeof value === "string" && DATE.test(value))) {
          errors.push(`${at(`releaseDates.${key}`)}: expected "YYYY-MM-DD" or null`);
        }
      }
    }
  }
  return errors;
}

/** Whole file: games, wikipedia matches, manual games. */
export function validateOverridesFile(file: Json): string[] {
  if (!isObject(file)) return ["overrides.json: expected an object"];
  const errors: string[] = [];
  for (const key of Object.keys(file)) {
    if (!["games", "wikipedia", "manualGames"].includes(key)) errors.push(`overrides.json: unknown section "${key}"`);
  }
  if (!isObject(file.games)) errors.push("games: expected an object");
  else for (const [id, o] of Object.entries(file.games)) errors.push(...validateGameOverride(id, o));

  if (file.wikipedia !== undefined) {
    if (!isObject(file.wikipedia)) errors.push("wikipedia: expected an object");
    else {
      for (const [page, ids] of Object.entries(file.wikipedia)) {
        if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string" && ID.test(id))) {
          errors.push(`wikipedia["${page}"]: expected a list of ids like "igdb:123" or "manual:slug"`);
        }
      }
    }
  }
  if (file.manualGames !== undefined) {
    if (!Array.isArray(file.manualGames)) errors.push("manualGames: expected a list");
    else {
      file.manualGames.forEach((m, i) => {
        if (!isObject(m) || typeof m.id !== "string" || !/^manual:[a-z0-9-]+$/.test(m.id) || typeof m.title !== "string") {
          errors.push(`manualGames[${i}]: needs an id "manual:<slug>" and a title`);
        }
      });
    }
  }
  return errors;
}
