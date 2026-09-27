/** View settings (ITERATION-4 §1): how the timeline looks, remembered in the browser. */
export interface ViewSettings {
  cardStyle: "full" | "compact";
  /** Same-day releases as one group (ITERATION-4 §4). */
  groupSameDay: boolean;
}

const DEFAULTS: ViewSettings = { cardStyle: "full", groupSameDay: true };
const STORAGE_KEY = "view";

export function loadView(): ViewSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<ViewSettings>;
    const view = { ...DEFAULTS, ...saved };
    if (view.cardStyle !== "full" && view.cardStyle !== "compact") view.cardStyle = DEFAULTS.cardStyle;
    if (typeof view.groupSameDay !== "boolean") view.groupSameDay = DEFAULTS.groupSameDay;
    return view;
  } catch {
    return { ...DEFAULTS };
  }
}

function saveView(v: ViewSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    // Storage unavailable: the choice lasts for this visit only.
  }
}

/** A choice between a few values, shown as a segmented control. */
interface Choice<K extends keyof ViewSettings> {
  key: K;
  label: string;
  options: { value: ViewSettings[K]; label: string; hint: string }[];
}

const CHOICES: Choice<"cardStyle">[] = [
  {
    key: "cardStyle",
    label: "Card style",
    options: [
      { value: "full", label: "Full", hint: "Dates, scores and details on every card" },
      { value: "compact", label: "Compact", hint: "Cover, title and badges; the selected card shows everything" },
    ],
  },
];

/** "View ▾" in the header: a small panel with the display settings. */
export class ViewMenu {
  private readonly button: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private view: ViewSettings;

  constructor(
    host: HTMLElement,
    initial: ViewSettings,
    private readonly onChange: (v: ViewSettings, changed: keyof ViewSettings) => void,
  ) {
    this.view = initial;
    const wrap = document.createElement("div");
    wrap.className = "view-menu";
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "view-menu__toggle";
    this.button.setAttribute("aria-expanded", "false");
    this.button.setAttribute("aria-controls", "view-panel");
    this.button.innerHTML = `<span>View</span><span class="filters__caret" aria-hidden="true">▾</span>`;

    this.panel = document.createElement("div");
    this.panel.className = "view-menu__panel";
    this.panel.id = "view-panel";
    this.panel.hidden = true;
    this.panel.setAttribute("role", "group");
    this.panel.setAttribute("aria-label", "View settings");
    for (const choice of CHOICES) this.panel.append(this.segmented(choice));
    this.panel.append(this.toggle("groupSameDay", "Group same-day releases", "3 or more games on one day become one group"));
    wrap.append(this.button, this.panel);
    host.prepend(wrap);

    this.button.addEventListener("click", () => this.setOpen(this.panel.hidden));
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target as Node)) this.setOpen(false);
    });
    wrap.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.panel.hidden) {
        e.stopPropagation();
        this.setOpen(false);
        this.button.focus();
      }
    });
  }

  private segmented<K extends keyof ViewSettings>(choice: Choice<K>) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "view-menu__choice";
    const legend = document.createElement("legend");
    legend.textContent = choice.label;
    const row = document.createElement("div");
    row.className = "view-menu__segments";
    const hint = document.createElement("p");
    hint.className = "view-menu__hint";
    const showHint = () => (hint.textContent = choice.options.find((o) => o.value === this.view[choice.key])?.hint ?? "");
    for (const option of choice.options) {
      const label = document.createElement("label");
      label.innerHTML = `<input type="radio"><span></span>`;
      const input = label.querySelector("input")!;
      input.name = `view-${choice.key}`;
      input.value = String(option.value);
      input.checked = this.view[choice.key] === option.value;
      label.querySelector("span")!.textContent = option.label;
      input.addEventListener("change", () => {
        if (!input.checked) return;
        this.view = { ...this.view, [choice.key]: option.value };
        saveView(this.view);
        showHint();
        this.onChange(this.view, choice.key);
      });
      row.append(label);
    }
    showHint();
    fieldset.append(legend, row, hint);
    return fieldset;
  }

  /** An on / off setting, drawn like the filter switches. */
  private toggle(key: "groupSameDay", label: string, hint: string) {
    const row = document.createElement("label");
    row.className = "filters__option view-menu__toggle-row";
    row.innerHTML = `<input type="checkbox"><span class="filters__switch" aria-hidden="true"></span><span><strong></strong><small></small></span>`;
    const input = row.querySelector("input")!;
    input.checked = this.view[key];
    row.querySelector("strong")!.textContent = label;
    row.querySelector("small")!.textContent = hint;
    input.addEventListener("change", () => {
      this.view = { ...this.view, [key]: input.checked };
      saveView(this.view);
      this.onChange(this.view, key);
    });
    return row;
  }

  private setOpen(open: boolean) {
    this.panel.hidden = !open;
    this.button.setAttribute("aria-expanded", String(open));
  }
}
