// ARVEX client management: list, search, create, edit and delete clients.
(() => {
  const list = document.getElementById("client-list");
  const page = document.getElementById("clients-page");
  const dialog = document.getElementById("client-dialog");
  if (!list || !page || !dialog) return;

  const $ = (id) => document.getElementById(id);
  const overviewParts = [
    document.querySelector(".welcome-row"),
    document.querySelector(".metric-grid"),
    document.querySelector(".content-grid"),
    document.querySelector(".main-content > .footer")
  ];
  let workspaceId = null;
  let clients = [];
  let editingId = null;
  let busy = false;

  const note = (message, error = false) => {
    $("client-form-note").textContent = message;
    $("client-form-note").style.color = error ? "#ff9baf" : "#c9a3f5";
  };

  const setPage = (name) => {
    const showClients = name === "clients";
    overviewParts.forEach(node => node?.classList.toggle("hidden", showClients));
    page.classList.toggle("hidden", !showClients);
    document.querySelectorAll(".nav-link").forEach(link => {
      link.classList.toggle("active", showClients ? link.getAttribute("href") === "#clients" : link.getAttribute("href") === "#overview");
    });
    const breadcrumb = document.querySelector(".breadcrumb strong");
    if (breadcrumb) breadcrumb.textContent = showClients ? "Clients" : "Overview";
    if (showClients) loadClients();
  };

  document.querySelectorAll('.nav-link[href="#clients"], .nav-link[href="#overview"]').forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      const target = link.getAttribute("href") === "#clients" ? "clients" : "overview";
      history.replaceState(null, "", target === "clients" ? "#clients" : "#overview");
      setPage(target);
    });
  });

  const getWorkspace = async () => {
    if (workspaceId) return workspaceId;
    const { data: auth, error: authError } = await supabaseClient.auth.getUser();
    if (authError) throw authError;
    if (!auth?.user) throw new Error("Please sign in again.");
    const { data, error } = await supabaseClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", auth.user.id)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data?.workspace_id) throw new Error("No workspace is linked to this account.");
    workspaceId = data.workspace_id;
    return workspaceId;
  };

  const renderClients = () => {
    const query = $("client-search").value.trim().toLowerCase();
    const filtered = clients.filter(client =>
      [client.name, client.company_name, client.email, client.phone]
        .some(value => String(value || "").toLowerCase().includes(query))
    );
    $("client-count").textContent = filtered.length + (filtered.length === 1 ? " client" : " clients");
    list.replaceChildren();

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "client-empty";
      const title = document.createElement("strong");
      title.textContent = query ? "No matching clients" : "No clients yet";
      const message = document.createElement("p");
      message.textContent = query ? "Try another search term." : "Add your first client to start organising projects and extra work.";
      empty.append(title, message);
      if (!query) {
        const add = document.createElement("button");
        add.className = "secondary-button";
        add.type = "button";
        add.textContent = "＋ Add your first client";
        add.addEventListener("click", openNewClient);
        empty.append(add);
      }
      list.append(empty);
      return;
    }

    filtered.forEach(client => {
      const card = document.createElement("article");
      card.className = "client-card";
      const details = document.createElement("div");
      details.className = "client-details";
      const name = document.createElement("strong");
      name.textContent = client.name;
      details.append(name);
      if (client.company_name) {
        const company = document.createElement("p");
        company.textContent = client.company_name;
        details.append(company);
      }
      const meta = document.createElement("div");
      meta.className = "client-meta";
      [client.email, client.phone].filter(Boolean).forEach(value => {
        const span = document.createElement("span");
        span.textContent = value;
        meta.append(span);
      });
      details.append(meta);
      const actions = document.createElement("div");
      actions.className = "client-actions";
      const edit = document.createElement("button");
      edit.className = "secondary-button";
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => openEditClient(client));
      const remove = document.createElement("button");
      remove.className = "client-delete";
      remove.type = "button";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => deleteClient(client));
      actions.append(edit, remove);
      card.append(details, actions);
      list.append(card);
    });
  };

  const loadClients = async () => {
    if (typeof supabaseClient === "undefined" || !supabaseClient) return;
    list.textContent = "Loading clients...";
    try {
      const id = await getWorkspace();
      const { data, error } = await supabaseClient
        .from("clients")
        .select("id,name,company_name,email,phone,notes,created_at")
        .eq("workspace_id", id)
        .order("name", { ascending: true });
      if (error) throw error;
      clients = data || [];
      renderClients();
    } catch (error) {
      console.error("ARVEX clients load failed:", error);
      list.textContent = error.message || "Could not load clients. Refresh and try again.";
    }
  };

  const openNewClient = () => {
    editingId = null;
    $("client-form").reset();
    $("client-dialog-title").textContent = "Add client";
    $("save-client-button").textContent = "Save client";
    note("Client details are private to your workspace.");
    dialog.showModal();
  };

  const openEditClient = (client) => {
    editingId = client.id;
    $("client-form").reset();
    $("client-name").value = client.name || "";
    $("client-company").value = client.company_name || "";
    $("client-email").value = client.email || "";
    $("client-phone").value = client.phone || "";
    $("client-notes").value = client.notes || "";
    $("client-dialog-title").textContent = "Edit client";
    $("save-client-button").textContent = "Save changes";
    note("Update this client's details.");
    dialog.showModal();
  };

  const saveClient = async () => {
    if (busy) return;
    const name = $("client-name").value.trim();
    if (!name) {
      note("Client name is required.", true);
      return;
    }
    busy = true;
    $("save-client-button").disabled = true;
    $("save-client-button").textContent = "Saving...";
    try {
      const id = await getWorkspace();
      const payload = {
        name,
        company_name: $("client-company").value.trim() || null,
        email: $("client-email").value.trim() || null,
        phone: $("client-phone").value.trim() || null,
        notes: $("client-notes").value.trim() || null
      };
      let result;
      if (editingId) {
        result = await supabaseClient.from("clients").update(payload).eq("id", editingId).eq("workspace_id", id);
      } else {
        result = await supabaseClient.from("clients").insert({ ...payload, workspace_id: id });
      }
      if (result.error) throw result.error;
      dialog.close();
      await loadClients();
    } catch (error) {
      console.error("ARVEX client save failed:", error);
      note(error.message || "Could not save this client.", true);
    } finally {
      busy = false;
      $("save-client-button").disabled = false;
      $("save-client-button").textContent = editingId ? "Save changes" : "Save client";
    }
  };

  const deleteClient = async (client) => {
    if (!window.confirm('Delete "' + client.name + '"? This cannot be undone. Clients linked to projects cannot be deleted.')) return;
    try {
      const id = await getWorkspace();
      const { error } = await supabaseClient.from("clients").delete().eq("id", client.id).eq("workspace_id", id);
      if (error) throw error;
      await loadClients();
    } catch (error) {
      console.error("ARVEX client delete failed:", error);
      window.alert(error.message || "Could not delete this client. It may be linked to a project.");
    }
  };

  $("add-client-button").addEventListener("click", openNewClient);
  $("save-client-button").addEventListener("click", saveClient);
  $("close-client-dialog").addEventListener("click", () => dialog.close());
  $("client-search").addEventListener("input", renderClients);

  const waitForClient = () => {
    if (typeof supabaseClient !== "undefined" && supabaseClient) {
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        if (session?.user && !page.classList.contains("hidden")) loadClients();
        if (!session?.user) {
          workspaceId = null;
          clients = [];
          setPage("overview");
        }
      });
      if (window.location.hash === "#clients") setPage("clients");
    } else {
      window.setTimeout(waitForClient, 100);
    }
  };
  waitForClient();
})();