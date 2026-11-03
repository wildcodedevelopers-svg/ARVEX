// ARVEX frontend foundation
// Supabase connection will be configured in a later step.
// Never place a Supabase secret/service-role key in browser code.

const ARVEX_CONFIG = {
  supabaseUrl: "https://tblygovkphxslmcgubgw.supabase.co",
  supabasePublishableKey: "" // Add the sb_publishable_ key only when we configure auth.
};

const dialog = document.getElementById("work-dialog");
const addButtons = [
  document.getElementById("add-work-button"),
  document.getElementById("empty-add-button")
];

addButtons.forEach((button) => {
  button?.addEventListener("click", () => dialog?.showModal());
});

dialog?.querySelector(".dialog-close")?.addEventListener("click", () => {
  dialog.close();
});

document.getElementById("demo-save-button")?.addEventListener("click", () => {
  const note = document.getElementById("form-note");
  if (note) note.textContent = "Preview only — database saving will be enabled after authentication is connected.";
});

document.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

console.info("ARVEX interface foundation loaded.");
