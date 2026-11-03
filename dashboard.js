// ARVEX workspace dashboard data
// Uses the authenticated Supabase client initialized by app.js.
(() => {
  const money = (amount, currency) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(Number(amount || 0));
    } catch {
      return (currency || "USD") + " " + Number(amount || 0).toFixed(2);
    }
  };

  const setMetric = (index, value) => {
    const node = document.querySelectorAll(".metric-value")[index];
    if (node) node.textContent = value;
  };

  const setWorkspaceName = (name) => {
    const node = document.querySelector(".workspace-switch strong");
    if (node) node.textContent = name || "My workspace";
  };

  const showDashboardError = (message) => {
    const activity = document.querySelector(".activity-panel .empty-state");
    if (activity) {
      activity.innerHTML = '<strong>Dashboard could not load</strong><p></p><button class="secondary-button" type="button" id="dashboard-retry">Retry</button>';
      activity.querySelector("p").textContent = message;
      activity.querySelector("#dashboard-retry").addEventListener("click", () => loadDashboard());
    }
  };

  const loadDashboard = async () => {
    if (typeof supabaseClient === "undefined" || !supabaseClient) return;
    const { data: authData } = await supabaseClient.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    const { data: membership, error: memberError } = await supabaseClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!membership?.workspace_id) {
      showDashboardError("No workspace membership was found for this account.");
      return;
    }

    const workspaceId = membership.workspace_id;
    const { data: workspace, error: workspaceError } = await supabaseClient
      .from("workspaces")
      .select("name,currency")
      .eq("id", workspaceId)
      .single();

    if (workspaceError) throw workspaceError;
    const currency = workspace.currency || "USD";
    setWorkspaceName(workspace.name);

    const { data: requests, error: requestError } = await supabaseClient
      .from("work_requests")
      .select("id,title,estimated_amount,status,requested_at,approved_at,completed_at,invoiced_at,approval_reference")
      .eq("workspace_id", workspaceId)
      .order("requested_at", { ascending: false });

    if (requestError) throw requestError;
    const rows = requests || [];
    const total = rows.reduce((sum, item) => sum + Number(item.estimated_amount || 0), 0);
    const approvedRows = rows.filter(item => item.approved_at || ["approved", "completed", "invoiced"].includes(String(item.status || "").toLowerCase()));
    const pendingRows = rows.filter(item => String(item.status || "").toLowerCase() === "pending_approval");
    const unbilledRows = approvedRows.filter(item => !item.invoiced_at && String(item.status || "").toLowerCase() !== "invoiced");
    setMetric(0, money(total, currency));
    setMetric(1, money(approvedRows.reduce((sum, item) => sum + Number(item.estimated_amount || 0), 0), currency));
    setMetric(2, money(pendingRows.reduce((sum, item) => sum + Number(item.estimated_amount || 0), 0), currency));
    setMetric(3, money(unbilledRows.reduce((sum, item) => sum + Number(item.estimated_amount || 0), 0), currency));

    const activity = document.querySelector(".activity-panel .empty-state");
    if (activity) {
      if (!rows.length) {
        activity.innerHTML = '<div class="empty-icon">⌁</div><strong>No extra work recorded yet</strong><p>Add your first request to start tracking its value.</p><button class="secondary-button" id="dashboard-add-work" type="button">＋ Add your first request</button>';
        activity.querySelector("#dashboard-add-work").addEventListener("click", () => document.getElementById("work-dialog")?.showModal());
      } else {
        activity.innerHTML = '<div class="activity-list"></div>';
        const list = activity.querySelector(".activity-list");
        rows.slice(0, 5).forEach(item => {
          const line = document.createElement("div");
          line.className = "activity-item";
          const heading = document.createElement("strong");
          heading.textContent = item.title || "Untitled request";
          const detail = document.createElement("p");
          detail.textContent = (item.status || "pending").replaceAll("_", " ") + " · " + money(item.estimated_amount, currency);
          line.append(heading, detail);
          list.append(line);
        });
      }
    }

    const attention = document.querySelector(".attention-empty");
    if (attention) {
      if (pendingRows.length || unbilledRows.length) {
        attention.innerHTML = "";
        const title = document.createElement("strong");
        title.textContent = pendingRows.length + " pending approval · " + unbilledRows.length + " approved but unbilled";
        const detail = document.createElement("p");
        detail.textContent = "Review these requests and follow up where needed.";
        attention.append(title, detail);
      }
    }
  };

  let loading = false;
  const safeLoad = async () => {
    if (loading) return;
    loading = true;
    try {
      await loadDashboard();
    } catch (error) {
      console.error("ARVEX dashboard load failed:", error);
      showDashboardError(error.message || "Please refresh and try again.");
    } finally {
      loading = false;
    }
  };

  const waitForClient = () => {
    if (typeof supabaseClient !== "undefined" && supabaseClient) {
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        if (session?.user) safeLoad();
      });
      supabaseClient.auth.getSession().then(({ data }) => {
        if (data?.session?.user) safeLoad();
      });
    } else {
      window.setTimeout(waitForClient, 100);
    }
  };
  waitForClient();
})();