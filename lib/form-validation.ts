import type { ErrorInfo } from "./errors";
// Native validity rules are inspected, but browser-language popovers are never shown.
// Call from a noValidate form and render errors using the selected application locale.
export function validateForm(form: HTMLFormElement): Record<string, ErrorInfo> {
  const errors: Record<string, ErrorInfo> = {};
  for (const element of Array.from(form.elements)) {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) ||
      !element.name ||
      element.disabled
    )
      continue;
    const v = element.validity;
    let info: ErrorInfo | null = null;
    if (v.valueMissing)
      info = { code: element.name === "consent" ? "consent" : "required" };
    else if (v.badInput || v.typeMismatch) info = { code: "format" };
    else if (v.patternMismatch)
      info = {
        code:
          element.name === "phone"
            ? "phone"
            : element.name === "telegram"
              ? "username"
              : "format",
      };
    else if (v.rangeUnderflow)
      info = { code: "min", limit: Number((element as HTMLInputElement).min) };
    else if (v.rangeOverflow)
      info = { code: "max", limit: Number((element as HTMLInputElement).max) };
    else if (v.stepMismatch) info = { code: "integer" };
    // Browser tooShort is not reliable for prefilled/programmatic values, so check length too.
    if (
      !info &&
      !(element instanceof HTMLSelectElement) &&
      element.type !== "checkbox" &&
      element.value
    ) {
      if (
        element.minLength > 0 &&
        element.value.trim().length < element.minLength
      )
        info = { code: "minLength", limit: element.minLength };
      else if (
        element.maxLength > 0 &&
        element.value.length > element.maxLength
      )
        info = { code: "maxLength", limit: element.maxLength };
      else if (element.required && !element.value.trim())
        info = { code: "required" };
    }
    if (info) errors[element.name] = { ...info, field: element.name };
  }
  return errors;
}
export function focusInvalid(
  form: HTMLFormElement,
  errors: Record<string, ErrorInfo>,
) {
  const first = Object.keys(errors)[0];
  const field = form.elements.namedItem(first);
  if (field instanceof HTMLElement) field.focus();
}
