// ARVEX authentication foundation
// Only the Supabase publishable key belongs in this browser app.
// NEVER add a secret/service-role key or database password here.

const ARVEX_CONFIG = {
  supabaseUrl: "https://tblygovkphxslmcgubgw.supabase.co",
  supabasePublishableKey: "sb_publishable_0jd-uya8yPy8fhFTDeV5oQ_IJ4rGVSN" // Paste your sb_publishable_ key between these quotes.
};

const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const authForm = document.getElementById("auth-form");
const authMessage = document.getElementById("auth-message");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");
const authSubmit = document.getElementById("auth-submit");
const nameField = document.getElementById("name-field");
const fullNameInput = document.getElementById("full-name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginTab = document.getElementById("login-tab");
const signupTab = document.getElementById("signup-tab");
const dialog = document.getElementById("work-dialog");

let authMode = "login";
let supabaseClient = null;

function showMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#ff9baf" : "#c9a3f5";
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  loginTab.classList.toggle("active", !signup);
  signupTab.classList.toggle("active", signup);
  nameField.classList.toggle("hidden-field", !signup);
  fullNameInput.required = signup;
  passwordInput.autocomplete = signup ? "new-password" : "current-password";
  authTitle.textContent = signup ? "Create your account" : "Welcome back";
  authSubtitle.textContent = signup ? "Start tracking the value of your work." : "Sign in to your ARVEX workspace.";
  authSubmit.textContent = signup ? "Create account" : "Sign in";
  showMessage("");
}

function showApp(user) {
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  const email = user?.email || "";
  document.getElementById("user-email").textContent = email;
  document.getElementById("user-avatar").textContent = (email[0] || "U").toUpperCase();
}

function showAuth() {
  appShell.classList.add("hidden");
  authScreen.classList.remove("hidden");
}

function initSupabase() {
  if (!window.supabase?.createClient) {
    showMessage("The authentication library did not load. Check your internet connection and refresh.", true);
    return false;
  }
  if (!ARVEX_CONFIG.supabasePublishableKey.trim()) {
    showMessage("Setup needed: add your Supabase sb_publishable_ key in app.js before signing in.", true);
    return false;
  }
  supabaseClient = window.supabase.createClient(
    ARVEX_CONFIG.supabaseUrl,
    ARVEX_CONFIG.supabasePublishableKey
  );
  return true;
}

loginTab.addEventListener("click", () => setAuthMode("login"));
signupTab.addEventListener("click", () => setAuthMode("signup"));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient && !initSupabase()) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  authSubmit.disabled = true;
  authSubmit.textContent = authMode === "signup" ? "Creating account..." : "Signing in...";
  showMessage("");

  try {
    if (authMode === "signup") {
      const fullName = fullNameInput.value.trim();
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      });
      if (error) throw error;
      if (data.session) {
        showApp(data.user);
      } else {
        showMessage("Account created. Check your email for the confirmation link, then return here to sign in.");
        setAuthMode("login");
        emailInput.value = email;
        passwordInput.value = "";
      }
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showApp(data.user);
    }
  } catch (error) {
    showMessage(error.message || "Authentication failed. Please try again.", true);
  } finally {
    authSubmit.disabled = false;
    authSubmit.textContent = authMode === "signup" ? "Create account" : "Sign in";
  }
});

document.getElementById("signout-button").addEventListener("click", async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error("Sign out failed:", error.message);
    return;
  }
  showAuth();
});

async function restoreSession() {
  if (!initSupabase()) return;
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    showMessage("Could not restore your session. Please sign in again.", true);
    return;
  }
  if (data.session?.user) showApp(data.session.user);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session?.user) showApp(session.user);
    else showAuth();
  });
}

restoreSession();

const addButtons = [
  document.getElementById("add-work-button"),
  document.getElementById("empty-add-button")
];
addButtons.forEach((button) => {
  button?.addEventListener("click", () => dialog?.showModal());
});
dialog?.querySelector(".dialog-close")?.addEventListener("click", () => dialog.close());
document.getElementById("demo-save-button")?.addEventListener("click", () => {
  const note = document.getElementById("form-note");
  if (note) note.textContent = "Preview only — database saving will be enabled after the workspace setup.";
});
document.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
console.info("ARVEX authentication interface loaded.");
