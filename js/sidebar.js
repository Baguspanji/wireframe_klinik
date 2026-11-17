/*
 * Sidebar terpusat untuk seluruh halaman Clinic ERP.
 * Cukup muat <script src="<base>js/sidebar.js"></script> sebelum main.js.
 * Semua item navigasi didefinisikan di NAV_SECTIONS agar tidak ada lagi
 * sidebar yang berbeda-beda antar halaman.
 */
(function () {
  "use strict";

  var script = document.currentScript || document.querySelector('script[src*="js/sidebar.js"]');
  var src = script ? (script.getAttribute("src") || "") : "";
  // "", "../", atau "../../" tergantung kedalaman halaman
  var base = src.replace(/js\/sidebar\.js.*$/, "");

  // Path halaman saat ini relatif terhadap root aplikasi
  var rootUrl = new URL(base || "./", window.location.href);
  var rootPath = rootUrl.pathname;
  var currentPath = window.location.pathname.indexOf(rootPath) === 0
    ? window.location.pathname.slice(rootPath.length)
    : window.location.pathname.replace(/^\//, "");
  if (!currentPath || currentPath.charAt(currentPath.length - 1) === "/") {
    currentPath += "index.html";
  }
  try { currentPath = decodeURIComponent(currentPath); } catch (e) { /* biarkan */ }
  var activeHash = (window.location.hash || "").replace("#", "");

  var NAV_SECTIONS = [
    {
      label: "GENERAL",
      items: [
        { label: "Dashboard", page: "dashboard", path: "index.html" }
      ]
    },
    {
      label: "OPERASIONAL",
      group: {
        id: "nav-operasional",
        title: "Operasional Klinik",
        match: "pages/operasional/",
        items: [
          { label: "Overview", path: "pages/operasional/index.html" },
          { label: "Pendaftaran & Antrean", path: "pages/operasional/pendaftaran.html" },
          { label: "+ Form Daftar Antrean", path: "pages/operasional/daftar-antrean.html" },
          { label: "Poli Umum", path: "pages/operasional/poli-umum.html" },
          { label: "+ Form SOAP Poli", path: "pages/operasional/pemeriksaan-poli-umum.html" },
          { label: "Poli Gigi", path: "pages/operasional/poli-gigi.html" },
          { label: "+ Form Odontogram", path: "pages/operasional/pemeriksaan-poli-gigi.html" },
          { label: "KIA & Kebidanan", path: "pages/operasional/kia.html" },
          { label: "+ Form KIA & ANC", path: "pages/operasional/pemeriksaan-kia.html" },
          { label: "IGD", path: "pages/operasional/igd.html" },
          { label: "+ Form Tindakan IGD", path: "pages/operasional/pemeriksaan-igd.html" },
          { label: "Rawat Inap", path: "pages/operasional/rawat-inap.html" },
          { label: "+ Form CPPT Ranap", path: "pages/operasional/pemeriksaan-ranap.html" },
          { label: "Laboratorium", path: "pages/operasional/laboratorium.html" },
          { label: "+ Form Hasil Lab", path: "pages/operasional/pemeriksaan-laboratorium.html" },
          { label: "Farmasi", path: "pages/operasional/farmasi.html" },
          { label: "+ Form Dispensing", path: "pages/operasional/pemeriksaan-farmasi.html" },
          { label: "Rekam Medis", path: "pages/operasional/rekam-medis.html" },
          { label: "+ Berkas RME Pasien", path: "pages/operasional/detail-rekam-medis.html" }
        ]
      }
    },
    {
      label: "KEUANGAN",
      group: {
        id: "nav-keuangan",
        title: "Keuangan",
        match: "pages/keuangan/",
        openOnHash: ["accounting", "billing", "reports"],
        items: [
          { label: "Overview Accounting", page: "accounting", path: "index.html#accounting" },
          { label: "Billing & Kasir", page: "billing", path: "index.html#billing" },
          { label: "+ Form Billing & Kasir", path: "pages/keuangan/billing-kasir.html" },
          { label: "+ Form Jurnal Umum", path: "pages/keuangan/jurnal-umum.html" },
          { label: "Chart of Accounts", path: "pages/keuangan/coa.html" },
          { label: "Buku Besar & Neraca Saldo", path: "pages/keuangan/buku-besar.html" },
          { label: "Laporan Keuangan", page: "reports", path: "index.html#reports" }
        ]
      }
    },
    {
      label: "MASTER DATA",
      group: {
        id: "nav-master",
        title: "Master Data",
        match: "pages/master/",
        items: [
          { label: "Overview Master", path: "pages/master/index.html" },
          { label: "Data Obat", path: "pages/master/obat.html" },
          { label: "Satuan & Jenis", path: "pages/master/satuan-jenis.html" },
          { label: "Dokter & Pengguna", path: "pages/master/dokter.html" },
          { label: "Tarif Layanan", path: "pages/master/tarif.html" },
          { label: "ICD-10 Diagnosis", path: "pages/master/icd-10.html" },
          { label: "ICD-9 Tindakan", path: "pages/master/icd-9.html" }
        ]
      }
    },
    {
      label: "MANAJEMEN BISNIS",
      group: {
        id: "nav-bisnis",
        title: "Manajemen Bisnis",
        match: "pages/bisnis/",
        openOnHash: ["management"],
        items: [
          { label: "Overview Bisnis", path: "pages/bisnis/index.html" },
          { label: "Pengadaan (PO)", path: "pages/bisnis/purchasing.html" },
          { label: "Supplier & Utang AP", path: "pages/bisnis/supplier-ap.html" },
          { label: "Biaya Operasional", path: "pages/bisnis/pengeluaran.html" },
          { label: "Aset Tetap & Depresiasi", path: "pages/bisnis/aset-tetap.html" },
          { label: "Payroll Karyawan", path: "pages/bisnis/payroll.html" },
          { label: "Remunerasi Medis", path: "pages/bisnis/remunerasi.html" }
        ]
      }
    },
    {
      label: "PENGATURAN",
      items: [
        { label: "Pengaturan Sistem", page: "settings", path: "index.html#settings" }
      ]
    }
  ];

  var isRootIndex = currentPath === "index.html" || currentPath === "";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function splitPath(path) {
    var parts = String(path).split("#");
    return { file: parts[0], hash: parts[1] || "" };
  }

  function isActive(item) {
    var target = splitPath(item.path);
    if (target.file !== currentPath) return false;
    if (target.hash || activeHash) return target.hash === activeHash;
    return true;
  }

  function hrefFor(path) {
    return base + path;
  }

  function renderItem(item, isSub) {
    var cls = "nav-item" + (isSub ? " nav-sub" : "");
    var active = isActive(item) ? " active" : "";
    if (isRootIndex && item.page) {
      return '<button type="button" class="' + cls + active + '" data-page="' + esc(item.page) + '">'
        + "<span>" + esc(item.label) + "</span></button>";
    }
    return '<a class="' + cls + active + '" href="' + esc(hrefFor(item.path)) + '">'
      + "<span>" + esc(item.label) + "</span></a>";
  }

  function groupIsOpen(group) {
    if (group.match && currentPath.indexOf(group.match) === 0) return true;
    if (group.openOnHash && group.openOnHash.indexOf(activeHash) !== -1) return true;
    return group.items.some(isActive);
  }

  function renderGroup(section) {
    var group = section.group;
    var open = groupIsOpen(group);
    var html = '<div class="nav-label">' + esc(section.label) + "</div>";
    html += '<div class="nav-group' + (open ? " open" : "") + '" id="' + esc(group.id) + '">';
    html += '<button type="button" class="nav-item nav-group-toggle" data-toggle="' + esc(group.id) + '">';
    html += '<span class="nav-left"><i class="nav-icon"></i><span>' + esc(group.title) + "</span></span>";
    html += '<span class="nav-caret"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></span>';
    html += "</button>";
    html += '<div class="nav-subitems">';
    html += group.items.map(function (item) { return renderItem(item, true); }).join("");
    html += "</div></div>";
    return html;
  }

  function renderSection(section) {
    if (section.group) return renderGroup(section);
    var html = '<div class="nav-label">' + esc(section.label) + "</div>";
    html += section.items.map(function (item) { return renderItem(item, false); }).join("");
    return html;
  }

  var sidebar = document.querySelector(".sidebar");
  if (!sidebar) {
    sidebar = document.createElement("aside");
    sidebar.className = "sidebar";
    document.body.insertBefore(sidebar, document.body.firstChild);
  }
  sidebar.id = "appSidebar";
  sidebar.innerHTML =
    '<div class="brand">'
    + '<div class="brand-icon">C</div>'
    + "<div><strong>Clinic ERP</strong><small>Management System</small></div>"
    + "</div>"
    + NAV_SECTIONS.map(renderSection).join("");
})();
