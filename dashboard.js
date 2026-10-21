
document.addEventListener("DOMContentLoaded", () => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const sidebar = $("#sidebar");
  const scrim = $("#scrim");
  let activePerson = "Alex Morgan";

  const chatData = {
    "Alex Morgan": [
      ["received", "Hi! I've uploaded the first draft. Let me know what you think."],
      ["sent", "Great, thanks! I'll review it and send feedback shortly."]
    ],
    "Jamie Lee": [
      ["received", "The new website layout is ready for review."],
      ["sent", "Thanks! I'll check the layout today."]
    ],
    "Sam Kim": [
      ["received", "Thanks for the feedback on the campaign!"],
      ["sent", "You're welcome. The new direction looks great."]
    ],
    "Riley Brooks": [
      ["received", "I've shared the updated copy for your review."],
      ["sent", "Thank you! I'll review it shortly."]
    ]
  };

  const initials = {
    "Alex Morgan": "AM",
    "Jamie Lee": "JL",
    "Sam Kim": "SK",
    "Riley Brooks": "RB"
  };

  const avatarColors = {
    "Alex Morgan": "",
    "Jamie Lee": "blue",
    "Sam Kim": "green",
    "Riley Brooks": "pink"
  };

  // Toast notifications
  function toast(message, title = "Evora") {
    const region = $("#toastRegion");
    const item = document.createElement("div");
    item.className = "toast";

    const heading = document.createElement("b");
    heading.textContent = title;

    const text = document.createElement("div");
    text.textContent = message;

    item.append(heading, text);
    region.append(item);

    window.setTimeout(() => item.remove(), 3500);
  }

  // Sidebar and page navigation
  function showPage(section) {
    const target = $(`#page-${section}`);

    if (!target) return;

    $$(".page").forEach(page => page.classList.remove("active"));
    target.classList.add("active");

    $$(".nav-item").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.section === section
      );
    });

    $("#breadcrumb").textContent = target.dataset.title || section;
    closeSidebar();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    scrim.classList.remove("show");
    $("#menuToggle").setAttribute("aria-expanded", "false");
  }

  
  $$(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      const section = button.dataset.section;

      console.log("Clicked navigation:", section);

      showPage(section);

      setTimeout(() => {
        const page = $(`#page-${section}`);

        console.log("Target page:", page);
        console.log("Page classes:", page?.className);
        console.log(
          "Page display:",
          page ? getComputedStyle(page).display : "not found"
        );
      }, 100);
    });
  });


  $$("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
      showPage(button.dataset.go);
    });
  });

  $("#menuToggle").addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("open");

    scrim.classList.toggle("show", isOpen);
    $("#menuToggle").setAttribute("aria-expanded", String(isOpen));
  });

  scrim.addEventListener("click", closeSidebar);

  // Project modal
  const modal = $("#projectModal");
  const projectForm = $("#projectForm");

  function openModal() {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    $("#newTitle").focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  $$("[data-open-project]").forEach(button => {
    button.addEventListener("click", openModal);
  });

  $("#closeModal").addEventListener("click", closeModal);
  $("#cancelModal").addEventListener("click", closeModal);

  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) closeModal();

    if ((event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k") {
      event.preventDefault();
      $("#globalSearch").focus();
    }
  });

  // Safely escape user-entered text before inserting HTML.
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function peso(amount) {
    return "₱" + Number(amount).toLocaleString("en-PH");
  }

  function updateCounts() {
    const cards = $$(".project-card");
    const active = cards.filter(card =>
      ["In Progress", "In Review"].includes(card.dataset.status)
    ).length;

    $("#projectCount").textContent = cards.length;
    $("#profileProjectCount").textContent = cards.length;
    $("#activeStat").textContent = active;
  }

  // Project search and status filter
  function filterProjects() {
    const query = $("#projectSearch").value.trim().toLowerCase();
    const status = $("#statusFilter").value;
    let visible = 0;

    $$(".project-card").forEach(card => {
      const matchesName = card.dataset.name.toLowerCase().includes(query);
      const matchesStatus =
        status === "all" || card.dataset.status === status;

      card.hidden = !(matchesName && matchesStatus);

      if (!card.hidden) visible++;
    });

    $("#projectEmpty").hidden = visible > 0;
  }

  $("#projectSearch").addEventListener("input", filterProjects);
  $("#statusFilter").addEventListener("change", filterProjects);

  // Create a project
  projectForm.addEventListener("submit", event => {
    event.preventDefault();

    if (!projectForm.reportValidity()) return;

    const title = $("#newTitle").value.trim();
    const category = $("#newCategory").value;
    const budget = $("#newBudget").value;
    const date = $("#newDeadline").value;
    const description = $("#newDescription").value.trim();

    const dateText = new Date(date + "T12:00:00")
      .toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });

    const card = document.createElement("article");
    card.className = "project-card";
    card.dataset.name = title;
    card.dataset.status = "Draft";

    card.innerHTML = `
      <span class="pill review">Draft</span>
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(description)}</p>
      <div class="meta-row">
        <span>Category</span><b>${escapeHTML(category)}</b>
      </div>
      <div class="meta-row">
        <span>Budget</span><b>${peso(budget)}</b>
      </div>
      <div class="meta-row">
        <span>Deadline</span><b>${escapeHTML(dateText)}</b>
      </div>
      <div class="progress-track"><i style="width:0%"></i></div>
      <small>0% complete</small>
    `;

    $("#projectGrid").prepend(card);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHTML(title)}</td>
      <td><span class="pill review">Draft</span></td>
      <td>${peso(budget)}</td>
      <td>${escapeHTML(dateText)}</td>
    `;

    $("#recentTable").prepend(row);

    projectForm.reset();
    closeModal();
    updateCounts();
    filterProjects();
    showPage("projects");

    toast(`"${title}" was added to your demo projects.`, "Project created");
  });

  // Search projects and freelancers from the top bar
  $("#globalSearch").addEventListener("input", event => {
    const query = event.target.value.trim().toLowerCase();

    if (!query) return;

    const matchingProject = $$(".project-card").some(card =>
      card.dataset.name.toLowerCase().includes(query)
    );

    const matchingFreelancer = $$(".freelancer-card").some(card =>
      (card.dataset.name + " " + card.dataset.skills)
        .toLowerCase().includes(query)
    );

    if (matchingProject) {
      showPage("projects");
      $("#projectSearch").value = event.target.value;
      filterProjects();
    } else if (matchingFreelancer) {
      showPage("browse");
      $("#freelancerSearch").value = event.target.value;
      filterFreelancers();
    }
  });

  // Freelancer search and category filter
  function filterFreelancers() {
    const query = $("#freelancerSearch").value.trim().toLowerCase();
    const category = $("#categoryFilter").value;
    let visible = 0;

    $$(".freelancer-card").forEach(card => {
      const searchable = (
        card.dataset.name + " " + card.dataset.skills
      ).toLowerCase();

      const matchesQuery = searchable.includes(query);
      const matchesCategory =
        category === "all" || card.dataset.category === category;

      card.hidden = !(matchesQuery && matchesCategory);

      if (!card.hidden) visible++;
    });

    $("#freelancerEmpty").hidden = visible > 0;
  }

  $("#freelancerSearch")?.addEventListener("input", filterFreelancers);
  $("#categoryFilter")?.addEventListener("change", filterFreelancers);

  // Messages
  function addMessage(type, text) {
    const box = document.createElement("div");
    box.className = `message ${type}`;

    const paragraph = document.createElement("p");
    paragraph.textContent = text;

    const time = document.createElement("small");
    time.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    box.append(paragraph, time);
    $("#chatMessages").append(box);

    $("#chatMessages").scrollTop = $("#chatMessages").scrollHeight;
  }

  function renderChat(name) {
    activePerson = name;

    $("#chatPerson").textContent = name;
    $("#chatInitials").textContent = initials[name] || "FR";
    $("#chatInitials").className =
      `avatar ${avatarColors[name] || ""}`;

    $$(".conversation").forEach(button => {
      button.classList.toggle("active", button.dataset.person === name);
    });

    const messages = $("#chatMessages");
    messages.replaceChildren();

    const day = document.createElement("div");
    day.className = "chat-day";
    day.textContent = "CONVERSATION PREVIEW";
    messages.append(day);

    (chatData[name] || []).forEach(([type, text]) => {
      addMessage(type, text);
    });
  }

  $$(".conversation").forEach(button => {
    button.addEventListener("click", () => {
      renderChat(button.dataset.person);
    });
  });

  $("#conversationSearch").addEventListener("input", event => {
    const query = event.target.value.toLowerCase();

    $$(".conversation").forEach(button => {
      button.hidden = !button.dataset.person.toLowerCase().includes(query);
    });
  });

  $("#messageForm").addEventListener("submit", event => {
    event.preventDefault();

    const input = $("#messageInput");
    const text = input.value.trim();

    if (!text) return;

    addMessage("sent", text);
    input.value = "";

    toast(`Demo message added to ${activePerson}'s conversation.`, "Message sent");
  });

  // Contact buttons open the selected freelancer's conversation
  $$("[data-contact]").forEach(button => {
    button.addEventListener("click", () => {
      const name = button.dataset.contact;

      if (!chatData[name]) chatData[name] = [];

      let conversation = $$(".conversation").find(
        item => item.dataset.person === name
      );

      if (!conversation) {
        conversation = document.createElement("button");
        conversation.className = "conversation";
        conversation.dataset.person = name;

        const avatar = document.createElement("span");
        avatar.className = `avatar ${avatarColors[name] || ""}`;
        avatar.textContent = initials[name] || "FR";

        const details = document.createElement("span");
        const title = document.createElement("b");
        title.textContent = name;

        const subtitle = document.createElement("small");
        subtitle.textContent = "Start a new conversation";

        details.append(title, subtitle);
        conversation.append(avatar, details);
        $("#conversationItems")?.prepend(conversation);

        // If the list has no wrapper, append to the conversation list.
        if (!conversation.isConnected) {
          $(".conversation-list").append(conversation);
        }

        conversation.addEventListener("click", () => renderChat(name));
      }

      renderChat(name);
      showPage("messages");
    });
  });

  // Payments filter
  $("#paymentFilter").addEventListener("change", event => {
    const status = event.target.value;

    $$("#paymentRows tr").forEach(row => {
      row.hidden = status !== "all" && row.dataset.payment !== status;
    });
  });

  $$(".receipt").forEach(button => {
    button.addEventListener("click", () => {
      toast(
        "This is a sample receipt. Connect real payment records to generate receipts.",
        "Receipt preview"
      );
    });
  });

  $$(".pay-demo").forEach(button => {
    button.addEventListener("click", () => {
      toast(
        "No payment was charged. Connect a secure payment provider to enable checkout.",
        "Pending invoice"
      );
    });
  });

  // Export visible transactions as CSV
  $("#exportCsv").addEventListener("click", () => {
    const rows = [
      ["Transaction", "Project", "Date", "Amount", "Status"]
    ];

    $$("#paymentRows tr").forEach(row => {
      if (!row.hidden) {
        rows.push([...row.querySelectorAll("td")].slice(0, 5)
          .map(cell => cell.innerText.trim()));
      }
    });

    const csv = rows.map(row =>
      row.map(value =>
        `"${String(value).replace(/"/g, '""')}"`
      ).join(",")
    ).join("\r\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "evora-transactions.csv";
    link.click();

    URL.revokeObjectURL(url);
    toast("Your sample transaction CSV has been exported.", "Export complete");
  });

  // Save profile
  function saveProfile() {
    const name = $("#profileName").value.trim() || "Client";
    const nameParts = name.split(/\s+/);
    const initialsText = nameParts
      .map(part => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    $("#profileHeading").textContent = name;
    $("#sideName").textContent = name;
    $("#topName").textContent = name;
    $("#sideInitials").textContent = initialsText;
    $("#topInitials").textContent = initialsText;
    $("#profileInitials").textContent = initialsText;

    $("#welcomeName").textContent = nameParts[0];
    $("#profileMessage").textContent = "Profile updated on this page.";

    toast("Your demo profile has been updated.", "Profile saved");
  }

  $("#profileForm").addEventListener("submit", event => {
    event.preventDefault();

    if (event.currentTarget.reportValidity()) saveProfile();
  });

  // Settings tabs
  $$(".setting-tab").forEach(button => {
    button.addEventListener("click", () => {
      $$(".setting-tab").forEach(tab => {
        tab.classList.toggle("active", tab === button);
      });

      ["general", "notifications", "privacy"].forEach(name => {
        $(`#settings-${name}`).hidden = name !== button.dataset.tab;
      });
    });
  });

  // Settings toggles
  $("#compactToggle").addEventListener("change", event => {
    document.body.classList.toggle("compact-mode", event.target.checked);
  });

  $("#motionToggle").addEventListener("change", event => {
    document.body.classList.toggle("reduce-motion", event.target.checked);
  });

  $("#activityToggle").addEventListener("change", event => {
    $("#activityList").hidden = !event.target.checked;
  });

  $("#saveSettings").addEventListener("click", () => {
    $("#settingsMessage").textContent = "Preferences saved.";
    toast("Display preferences updated for this demo.", "Settings saved");
  });

  $$("[data-save-notifications]").forEach(button => {
    button.addEventListener("click", () => {
      toast("Notification preferences updated for this demo.", "Settings saved");
    });
  });

  // Other buttons
  $("#notifications").addEventListener("click", () => {
    toast("You have 3 sample message notifications and 1 project update.", "Notifications");
  });

  $("#helpButton").addEventListener("click", () => {
    toast("Add your support URL here when your Help Center is available.", "Help Center");
  });

  // Set the earliest project deadline to today
  const deadline = $("#newDeadline");
  const now = new Date();

  deadline.min = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);

  updateCounts();
});
async function loadDashboard() {
    const res = await fetch('api/get_user.php');

    if (res.status === 401) {
        window.location.href = 'index.html';   // not logged in
        return;
    }

    const data = await res.json();
    console.log(data.user);   // use this to fill your dashboard
}

loadDashboard();