// ARVEX: save extra-work requests to the authenticated workspace.
(() => {
  const button = document.getElementById("demo-save-button");
  const note = document.getElementById("form-note");
  const dialog = document.getElementById("work-dialog");
  if (!button || !note || !dialog) return;

  const field = (id) => document.getElementById(id);
  const setNote = (message, error = false) => {
    note.textContent = message;
    note.style.color = error ? "#ff9baf" : "#c9a3f5";
  };

  button.textContent = "Save extra work";
  button.addEventListener("click", async () => {
    if (typeof supabaseClient === "undefined" || !supabaseClient) {
      setNote("Your session is not ready. Refresh the page and sign in again.", true);
      return;
    }

    const clientName = field("request-client")?.value.trim();
    const projectName = field("request-project")?.value.trim();
    const title = field("request-title")?.value.trim();
    const amountText = field("request-amount")?.value.trim();
    const description = field("request-details")?.value.trim();
    const amount = Number(amountText);

    if (!clientName || !projectName || !title || amountText === "" || !Number.isFinite(amount) || amount < 0) {
      setNote("Enter a client, project, request title, and a valid non-negative amount.", true);
      return;
    }

    button.disabled = true;
    button.textContent = "Saving...";
    setNote("Saving your request...");

    try {
      const { data: authResult, error: authError } = await supabaseClient.auth.getUser();
      if (authError) throw authError;
      const user = authResult?.user;
      if (!user) throw new Error("Your session has expired. Sign in again.");

      const { data: membership, error: membershipError } = await supabaseClient
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership?.workspace_id) throw new Error("No workspace is linked to this account.");

      const workspaceId = membership.workspace_id;

      let { data: client, error: clientLookupError } = await supabaseClient
        .from("clients")
        .select("id")
        .eq("workspace_id", workspaceId)
        .ilike("name", clientName)
        .limit(1)
        .maybeSingle();
      if (clientLookupError) throw clientLookupError;

      if (!client) {
        const { data, error } = await supabaseClient
          .from("clients")
          .insert({ workspace_id: workspaceId, name: clientName })
          .select("id")
          .single();
        if (error) throw error;
        client = data;
      }

      let { data: project, error: projectLookupError } = await supabaseClient
        .from("projects")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("client_id", client.id)
        .ilike("name", projectName)
        .limit(1)
        .maybeSingle();
      if (projectLookupError) throw projectLookupError;

      if (!project) {
        const { data, error } = await supabaseClient
          .from("projects")
          .insert({ workspace_id: workspaceId, client_id: client.id, name: projectName })
          .select("id")
          .single();
        if (error) throw error;
        project = data;
      }

      const { error: requestError } = await supabaseClient
        .from("work_requests")
        .insert({
          workspace_id: workspaceId,
          project_id: project.id,
          title,
          description: description || null,
          estimated_amount: amount,
          status: "pending_approval"
        });
      if (requestError) throw requestError;

      setNote("Saved successfully. Refreshing your dashboard...");
      field("request-form")?.reset();
      window.setTimeout(() => {
        dialog.close();
        window.location.reload();
      }, 700);
    } catch (error) {
      console.error("ARVEX save request failed:", error);
      setNote(error.message || "Could not save this request. Please try again.", true);
    } finally {
      button.disabled = false;
      button.textContent = "Save extra work";
    }
  });
})();