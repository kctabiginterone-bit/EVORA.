document.addEventListener("DOMContentLoaded", () => {
    const navItems = document.querySelectorAll(".nav-item[data-section]");
    const pages = document.querySelectorAll(".page");
    const pageTitle = document.getElementById("pageTitle");
    const goButtons = document.querySelectorAll("[data-go]");

    // Navigate between dashboard pages
    function showPage(pageName) {
        pages.forEach((page) => {
            page.classList.toggle(
                "active",
                page.id === `page-${pageName}`
            );
        });

        navItems.forEach((item) => {
            item.classList.toggle(
                "active",
                item.dataset.section === pageName
            );
        });

        if (pageTitle) {
            const activeItem = [...navItems].find(
                (item) => item.dataset.section === pageName
            );

            pageTitle.textContent = activeItem
                ? activeItem.textContent.trim()
                : pageName.replaceAll("-", " ");
        }
    }

    // Sidebar navigation
    navItems.forEach((item) => {
        item.addEventListener("click", (event) => {
            event.preventDefault();
            showPage(item.dataset.section);
        });
    });

    // Buttons that open a specific page
    goButtons.forEach((button) => {
        button.addEventListener("click", () => {
            showPage(button.dataset.go);
        });
    });

    // Project form
    const projectForm = document.getElementById("projectForm");
    const projectMessage = document.getElementById("projectMessage");

    if (projectForm) {
        projectForm.addEventListener("submit", (event) => {
            event.preventDefault();

            if (projectMessage) {
                projectMessage.textContent =
                    "Form ready. Backend connection is still needed to save your project.";
            }
        });
    }

    // Freelancer search
    const freelancerSearch = document.getElementById("freelancerSearch");
    const freelancersList = document.getElementById("freelancersList");

    if (freelancerSearch && freelancersList) {
        freelancerSearch.addEventListener("input", () => {
            const searchText = freelancerSearch.value.toLowerCase();

            freelancersList.querySelectorAll(".freelancer-card").forEach((card) => {
                card.hidden = !card.textContent
                    .toLowerCase()
                    .includes(searchText);
            });
        });
    }

    // Open the Overview page first
    showPage("overview");

    console.log("Client Dashboard JavaScript loaded.");
});
