// Toggle sub-menu sidebar
document.querySelectorAll("[data-toggle]").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const group = document.getElementById(btn.dataset.toggle);
    if (group) group.classList.toggle("open");
  });
});
