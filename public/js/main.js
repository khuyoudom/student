const menuToggle = document.querySelector("[data-menu-toggle]");
const nav = document.getElementById("main-nav");
const menuBackdrop = document.querySelector("[data-menu-backdrop]");
const themeToggles = document.querySelectorAll("[data-theme-toggle]");

function closeMenu() {
  if (!nav) return;
  nav.classList.remove("is-open");
  if (menuBackdrop) {
    menuBackdrop.classList.remove("is-open");
  }
  document.body.style.overflow = "";
}

function openMenu() {
  if (!nav) return;
  nav.classList.add("is-open");
  if (menuBackdrop) {
    menuBackdrop.classList.add("is-open");
  }
  document.body.style.overflow = "hidden";
}

if (menuToggle && nav) {
  menuToggle.addEventListener("click", () => {
    if (nav.classList.contains("is-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  nav.querySelectorAll("a").forEach((item) => {
    item.addEventListener("click", () => {
      closeMenu();
    });
  });
}

if (menuBackdrop) {
  menuBackdrop.addEventListener("click", () => {
    closeMenu();
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();
  }
});

if (themeToggles.length > 0) {
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);

  themeToggles.forEach((themeToggle) => {
    themeToggle.addEventListener("click", () => {
      const nextTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nextTheme);
      localStorage.setItem("theme", nextTheme);
    });
  });
}

const chartCanvas = document.getElementById("ordersChart");
if (chartCanvas && window.Chart) {
  const source = chartCanvas.getAttribute("data-chart");
  const dataObject = source ? JSON.parse(source) : {};
  const labels = Object.keys(dataObject).length ? Object.keys(dataObject) : ["pending", "paid", "cancelled"];
  const values = labels.map((label) => Number(dataObject[label] || 0));

  new Chart(chartCanvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: ["#0f766e", "#16a34a", "#f97316"]
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

const addProductForm = document.querySelector("[data-add-product-form]");
if (addProductForm) {
  const formError = addProductForm.querySelector("[data-form-error]");
  const titleInput = addProductForm.querySelector("input[name='title']");

  addProductForm.addEventListener("submit", (event) => {
    if (!titleInput || titleInput.value.trim()) {
      if (formError) {
        formError.hidden = true;
        formError.textContent = "";
      }
      return;
    }

    event.preventDefault();
    if (formError) {
      formError.textContent = "Title is required.";
      formError.hidden = false;
    }
    titleInput.focus();
  });
}
