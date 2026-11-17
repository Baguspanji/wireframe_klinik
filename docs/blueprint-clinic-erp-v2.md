# Blueprint Clinic ERP — Versi 2.0 (Konteks Indonesia)
## Sistem Informasi Manajemen Klinik Terintegrasi

> **Status:** Revisi 2.0, 17 November 2026, hasil validasi v1 terhadap regulasi dan praktik klinik di Indonesia. Temuan dan studi kasus ada di `laporan-validasi-studi-kasus-clinic-erp.md`.
> **Penanda:** `[BARU v2]` dan `[REVISI v2]` menandai bagian yang berubah. `[V]` berarti harus diverifikasi ke teks resmi dan ahli hukum/pajak sebelum dikunci sebagai aturan sistem.
> Dokumen ini bukan nasihat hukum, pajak, atau akuntansi.

**Platform:** Laravel Modular Monolith  
**Orientasi:** Klinik pratama/utama dan jaringan klinik di Indonesia (rawat jalan, IGD/pelayanan 24 jam, rawat inap klinik), mandiri maupun mitra JKN  
**Pendekatan:** Domain-driven modular architecture, workflow-driven, centralized billing, accrual accounting  
**Tujuan:** Mengintegrasikan pelayanan pasien, operasional klinis, transaksi keuangan, persediaan, dan manajemen bisnis dalam satu sistem.

## Ringkasan Perubahan v2

| # | Perubahan | Alasan |
|---|---|---|
| 1 | Domain bertambah dari 7 menjadi 9: **Integration & Compliance Hub** dan **Practitioner & Remuneration** | SATUSEHAT, BPJS, SIPNAP, STR/SIP, UU PDP tidak punya rumah di v1 |
| 2 | Billing berbasis **pembayar (payer)**: billing account, kontrak, kapitasi, klaim, LOG, deposit, paket | v1 hanya mampu tarif per layanan, pembayar tunggal |
| 3 | **Kode pajak per item katalog**, tarif ber-tanggal-berlaku | Jasa medis PPN dibebaskan, obat tetap BKP |
| 4 | Praktisi: STR/SIP, jadwal, bagi hasil jasa medis | Guard legalitas dan remunerasi dokter mitra |
| 5 | Kepatuhan privasi: consent, hak subjek data, insiden 3x24 jam, break-glass, retensi | UU PDP, data kesehatan = data spesifik |
| 6 | Perbaikan skema: `cashier_sessions`, `outbox_events`, `processed_events`, tautan admission→visit, penyatuan batch, kepemilikan tabel, terminologi | Cacat integritas v1 |
| 7 | Roadmap baru: Tahap 0 kepatuhan, Tahap 2 pembayar (JKN/asuransi), event akuntansi sejak Tahap 1 | Urutan v1 tidak cocok untuk klinik Indonesia |
| 8 | Keputusan default menggantikan sebagian pertanyaan terbuka | Mempercepat desain |
| 9 | Lampiran register regulasi dan glosarium | Keterlacakan |

---

# 1. Visi dan Batas Sistem

## 1.1 Visi

Clinic ERP merupakan platform terintegrasi untuk mengelola seluruh siklus operasional klinik, mulai dari pasien datang, menerima pelayanan medis, mendapatkan obat atau pemeriksaan penunjang, menyelesaikan administrasi pembayaran, hingga seluruh transaksi tercatat dalam laporan keuangan.

Sistem tidak hanya berfungsi sebagai SIM Klinik atau rekam medis elektronik, tetapi juga sebagai ERP untuk mengelola bisnis fasilitas kesehatan.

## 1.2 Tujuan utama

1. Mengintegrasikan data pasien dan riwayat pelayanan.
2. Mengelola berbagai jenis unit pelayanan melalui konfigurasi yang fleksibel.
3. Menghubungkan Poli, IGD, Rawat Inap, Laboratorium, dan Farmasi.
4. Memusatkan seluruh transaksi layanan ke Billing Engine.
5. Mengintegrasikan pembayaran dengan kasir dan akuntansi.
6. Mengelola persediaan obat, BHP, pembelian, dan supplier.
7. Menghasilkan laporan operasional dan laporan keuangan.
8. Menyediakan audit trail untuk aktivitas klinis dan finansial.

## 1.3 Batas domain

Sistem dibagi menjadi sembilan domain utama:

| Domain | Tanggung jawab |
|---|---|
| Core Platform | Identitas, konfigurasi, hak akses, workflow, audit |
| Front Office | Pendaftaran, kunjungan, loket, antrean, jadwal dokter, verifikasi kepesertaan |
| Clinical Services | Poli, IGD, rawat inap, rekam medis |
| Supporting Services | Laboratorium, farmasi, gudang |
| Billing & Financial Operations | Tagihan, kasir, pembayaran, penjamin |
| Accounting & Finance | COA, jurnal, buku besar, laporan |
| Business Management | Purchasing, supplier, aset, payroll, pajak |
| Integration & Compliance Hub `[BARU v2]` | SATUSEHAT, BPJS, SIPNAP, pembayaran digital, terminologi, consent, insiden data |
| Practitioner & Remuneration `[BARU v2]` | Praktisi, STR/SIP, jadwal, bagi hasil jasa medis |

## 1.4 Prinsip arsitektur

- Satu basis data utama dengan batas domain yang jelas.
- Setiap modul memiliki tanggung jawab dan service layer sendiri.
- Modul tidak boleh mengakses atau memodifikasi tabel domain lain secara sembarangan.
- Integrasi antar-modul melalui application service, domain event, atau integration event.
- Data klinis disimpan dalam struktur terukur, bukan seluruhnya dalam JSON.
- JSON digunakan untuk konfigurasi form, metadata, dan kebutuhan yang memang dinamis.
- Semua transaksi finansial memiliki sumber transaksi yang dapat ditelusuri.
- Perubahan penting harus memiliki audit trail.
- Data historis harus tetap dapat dipertanggungjawabkan meskipun konfigurasi berubah.
- `[BARU v2]` Setiap tabel transaksi membawa `facility_id`; identitas pasien dan master berada pada `organization_id`. Mendukung satu klinik maupun jaringan tanpa migrasi ulang.
- `[BARU v2]` Parameter regulasi (tarif pajak, batas tempat tidur, batas lama inap, tenggat pelaporan, masa retensi) disimpan sebagai konfigurasi ber-tanggal-berlaku, bukan konstanta di kode.
- `[BARU v2]` Integrasi eksternal melalui adapter di Integration Hub; domain inti tidak mengenal format pihak ketiga.
- `[BARU v2]` Sistem membantu kepatuhan (guard, pengingat, laporan); tanggung jawab hukum tetap pada penyelenggara fasilitas.

## 1.5 Konteks Indonesia dan Asumsi Dasar `[BARU v2]`

### 1.5.1 Cakupan fasilitas

| Jenis fasilitas | Status | Catatan |
|---|---|---|
| Klinik pratama rawat jalan | Didukung | Poli umum/gigi/KIA; farmasi opsional |
| Klinik pratama rawat inap | Didukung | Batas tempat tidur dan lama inap sebagai kebijakan fasilitas `[V]` |
| Klinik utama (spesialistik) | Didukung | Dokter spesialis per layanan; umumnya mandiri/asuransi |
| Jaringan klinik (multi-cabang/badan usaha) | Didukung sejak desain | `organization_id`, `legal_entity_id`, `facility_id` |
| Puskesmas dan rumah sakit | Di luar cakupan | Regulasi berbeda (SIMRS, INA-CBG/iDRG, SIRS, akreditasi) |

### 1.5.2 Peta regulasi dan dampak desain

| Topik | Ketentuan ringkas | Dampak desain | Status |
|---|---|---|---|
| RME | Setiap fasyankes termasuk klinik wajib RME terintegrasi SATUSEHAT (Permenkes 24/2022; transisi s.d. 31 Des 2023) | Integration Hub 2.9 A | Terkonfirmasi |
| Retensi dan backup RME | Retensi paling singkat 25 tahun sejak kunjungan terakhir; wajib ada backup | Tanpa hapus fisik, arsip berjenjang, DR | `[V]` |
| Klinik | Pratama/utama; pratama rawat inap berbadan usaha, 5–10 tempat tidur, maks. 5 hari (Permenkes 9/2014); perizinan berbasis risiko (PP 28/2024, Permenkes 11/2025) | `facility_policies` | `[V]` |
| STR/SIP | STR seumur hidup; SIP per tempat praktik oleh pemda (SIP ke-1..3); nakes tanpa SIP berisiko pidana | Guard legalitas 2.8 | Terkonfirmasi, pasal `[V]` |
| JKN FKTP | Kapitasi + non-kapitasi; PCare, Mobile JKN antrean, i-Care; bridging diajukan klinik ke BPJS | 2.5, 2.9 B, 3.7 | `[V]` ke BPJS |
| Narkotika/psikotropika | Surat pesanan khusus; hanya dengan resep; lapor SIPNAP bulanan (umumnya tgl 10) | 2.4 B, 3.10 | Terkonfirmasi |
| Apoteker | Klinik rawat inap wajib apoteker penanggung jawab kefarmasian | Guard SIPA, verifikasi resep | `[V]` |
| PPN | Jasa medis dibebaskan (PP 49/2022); obat tetap BKP; PKP bila peredaran usaha > Rp4,8 miliar | `tax_codes`, 2.7 | Terkonfirmasi; tarif `[V]` |
| UU PDP | Data kesehatan = data spesifik; notifikasi insiden 3x24 jam; PP 33/2026; Lembaga PDP belum final per pertengahan 2026 | 2.9 (privasi), 5.9 | `[V]` |
| Gawat darurat | Fasyankes dilarang menolak pasien gawat darurat atau meminta uang muka lebih dulu | Aturan IGD | `[V]` |
| Residensi data | Belum ada kepastian kewajiban simpan di dalam negeri | Default hosting wilayah Indonesia | `[V]` |

Daftar lengkap ada di Lampiran A.

---

# 2. Peta Modul dan Tanggung Jawab

## 2.1 Core Platform

Core Platform menjadi fondasi semua modul.

### Fitur

- Manajemen pengguna.
- Role dan permission.
- Service unit.
- Penugasan pengguna ke unit.
- Konfigurasi fasilitas.
- Workflow engine.
- Master data.
- Audit log.
- Notification.
- Document management.
- System configuration.

### Entitas utama

- `users`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`
- `service_units`
- `service_unit_types`
- `service_unit_users`
- `service_unit_modules`
- `workflow_definitions`
- `workflow_transitions`
- `system_settings`
- `audit_logs`
- `attachments`
- `organizations` `[BARU v2]`
- `legal_entities` `[BARU v2]`
- `facilities` `[BARU v2]`
- `facility_policies` `[BARU v2]`
- `numbering_sequences` `[BARU v2]`
- `outbox_events` `[BARU v2]`
- `processed_events` `[BARU v2]`

### Prinsip penting

Role tidak sama dengan penugasan unit.

Satu pengguna dapat bertugas sebagai petugas loket sekaligus kasir, atau dokter pada lebih dari satu Poli. Hak akses menentukan tindakan yang boleh dilakukan, sedangkan penugasan menentukan konteks unit tempat pengguna bekerja.

`[BARU v2]` **Cakupan fasilitas.** Setiap penugasan terikat pada `facility_id`. Akses data pasien lintas cabang tersedia untuk pengguna berhak, dan akses darurat (break-glass) memerlukan alasan, dicatat, dan ditinjau (lihat 2.9 dan 5.9).

## 2.2 Front Office

Mengelola proses administratif sebelum dan selama pasien menerima pelayanan.

### Fitur

- Registrasi pasien baru.
- Pencarian pasien lama.
- Verifikasi identitas.
- Pendaftaran kunjungan.
- Pemilihan unit pelayanan.
- Penjamin pasien.
- Nomor antrean.
- Administrasi rujukan.
- Administrasi pendaftaran rawat inap.
- `[BARU v2]` Janji temu dan jadwal dokter (kuota per poli/dokter).
- `[BARU v2]` Antrean daring (termasuk Mobile JKN) dan check-in.
- `[BARU v2]` Verifikasi kepesertaan (JKN/asuransi) dan identitas (NIK).
- `[BARU v2]` Identitas sementara untuk pasien tak dikenal, bayi, WNA.

### Entitas utama

- `patients`
- `patient_identifiers`
- `patient_addresses`
- `patient_contacts`
- `patient_visits`
- `visit_referrals`
- `queue_counters`
- `queue_tickets`
- `registration_sessions`
- `appointments` `[BARU v2]`
- `visit_coverages` `[BARU v2]` (pembayar per kunjungan)

### Pembedaan fungsi

**Loket** bertanggung jawab atas pendaftaran dan administrasi kunjungan.

**Kasir** bertanggung jawab atas tagihan, penerimaan uang, pembayaran, dan rekonsiliasi.

Kedua fungsi dapat dijalankan oleh pengguna yang sama, tetapi aktivitas dan permission-nya tetap dipisahkan.

### Penanganan identitas pasien di Indonesia `[BARU v2]`

- NIK (16 digit) adalah pengenal utama dan kunci pencarian IHS Number di SATUSEHAT. Validasi format dan kode wilayah sebelum disimpan; NIK disimpan terenkripsi.
- Bayi baru lahir: gunakan identitas sementara berelasi dengan ibu (NIK ibu sebagai rujukan) sampai NIK anak tersedia.
- WNA: paspor/KITAS sebagai tipe pengenal.
- Pasien tak dikenal di IGD: identitas sementara (`TEMP_ID`) dengan penanda; wajib ada proses penggabungan (merge) yang menjaga jejak audit dan mengirim koreksi ke sistem eksternal.
- Nomor kartu BPJS disimpan sebagai coverage, bukan sebagai identitas pasien.
- Wali/penanggung jawab disimpan terpisah (`patient_contacts` dengan peran).

## 2.3 Clinical Services

Mengelola seluruh proses pelayanan medis.

### A. Poli dinamis

Poli tidak dibuat sebagai modul aplikasi terpisah. Poli menggunakan satu mekanisme pelayanan dengan konfigurasi workflow dan fitur.

Contoh:

| Poli | Fitur yang diaktifkan |
|---|---|
| Poli Umum | SOAP, diagnosis, tindakan, resep, lab |
| Poli Gigi | SOAP, diagnosis, odontogram, tindakan, resep |
| Poli KIA | SOAP, ANC, kohort ibu hamil |
| Poli Anak | SOAP, antropometri, kohort anak |
| Poli Lansia | SOAP, diagnosis, skrining geriatri |

Entitas:

- `service_units`
- `service_unit_modules`
- `encounters`
- `clinical_notes`
- `encounter_diagnoses`
- `medical_procedures`
- `clinical_measurements`
- `clinical_forms`
- `clinical_form_submissions`

Konfigurasi Poli menentukan fitur yang tersedia, tetapi data klinis tetap disimpan dalam tabel domain yang terstruktur.

### B. Rekam Medis

Menjadi pusat dokumentasi klinis pasien.

Fitur:

- Riwayat kunjungan.
- SOAP.
- Diagnosis.
- Tindakan.
- Riwayat resep.
- Hasil laboratorium.
- Riwayat alergi.
- Riwayat penyakit.
- Riwayat rawat inap.
- Dokumen medis.

Entitas:

- `medical_records`
- `clinical_notes`
- `clinical_note_versions`
- `encounter_diagnoses`
- `patient_allergies`
- `patient_medical_histories`
- `clinical_measurements`
- `informed_consents` `[BARU v2]`
- `clinical_documents` `[BARU v2]` (surat sakit, surat rujukan, resume, hasil MCU; mendukung tanda tangan elektronik bila diputuskan)
- `terminology_codes` `[BARU v2]` (ICD-10, kode tindakan/KPTL, LOINC; dikelola Integration Hub)

`[REVISI v2]` Tidak ada entitas `medical_records` terpisah. Rekam medis adalah tampilan agregat atas encounter, catatan klinis, diagnosis, tindakan, resep, hasil lab, dan dokumen milik pasien.

### C. IGD

IGD adalah unit klinis tersendiri, bukan sekadar Poli dengan antrean berbeda.

Workflow:

1. Pasien datang melalui walk-in, rujukan, atau ambulans.
2. Registrasi darurat.
3. Triase.
4. Pemeriksaan dan asesmen.
5. Diagnosis.
6. Tindakan dan monitoring.
7. Permintaan laboratorium atau farmasi.
8. Observasi.
9. Keputusan akhir.

Disposisi:

- Pulang.
- Rawat inap.
- Rujuk.
- Meninggal.

Entitas:

- `emergency_registrations`
- `triage_assessments`
- `emergency_assessments`
- `emergency_observations`
- `emergency_dispositions`

Penanganan darurat tidak boleh bergantung pada penyelesaian pembayaran terlebih dahulu.

`[BARU v2]` Catatan Indonesia:
- Pasien dilayani tanpa syarat uang muka; ini juga ketentuan UU Kesehatan `[V]`. Billing berjalan di belakang layanan.
- Pasien tak dikenal memakai identitas sementara (2.2) dan dapat digabung kemudian.
- Kasus kecelakaan lalu lintas dapat melibatkan penjamin program tertentu `[V]`; kasus medikolegal (kekerasan, kecelakaan) diberi penanda dan dokumentasi lanjutan.
- Kebijakan fasilitas menentukan apakah IGD berstatus unit tersendiri atau pelayanan 24 jam poli klinik.

### D. Rawat Inap

Rawat inap menggunakan konsep admission longitudinal.

Satu admission berlangsung selama beberapa hari dan memiliki banyak catatan klinis, observasi, tindakan, pemberian obat, serta perpindahan tempat tidur.

Fitur:

- Admisi rawat inap.
- Bed management.
- Penempatan pasien.
- Perpindahan kamar.
- SOAP harian.
- Catatan keperawatan.
- Monitoring pasien.
- Medication Administration Record.
- Permintaan laboratorium.
- Discharge planning.
- Resume medis.

Entitas:

- `inpatient_admissions`
- `buildings`
- `rooms`
- `beds`
- `bed_assignments`
- `inpatient_rounds`
- `nursing_notes`
- `patient_observations`
- `medication_administrations`
- `discharge_summaries`

Status bed:

- Available.
- Occupied.
- Cleaning.
- Maintenance.
- Out of Service.

`[BARU v2]` **Kebijakan fasilitas rawat inap.** Kapasitas tempat tidur dan lama inap maksimum untuk klinik pratama (menurut Permenkes 9/2014: 5–10 tempat tidur, maks. 5 hari) disimpan di `facility_policies` ber-tanggal-berlaku `[V]`. Sistem memberi peringatan sebelum batas terlampaui dan mewajibkan keputusan rujuk/pulang yang tercatat.

## 2.4 Supporting Services

### A. Laboratorium

Laboratorium adalah unit penunjang independen yang menerima order dari berbagai unit klinis.

Workflow:

1. Dokter membuat permintaan pemeriksaan.
2. Order masuk ke worklist laboratorium.
3. Petugas melakukan pengambilan spesimen.
4. Pemeriksaan dilakukan.
5. Hasil dimasukkan.
6. Hasil divalidasi.
7. Hasil dikirim kembali ke rekam medis dan unit peminta.

Entitas:

- `lab_test_categories`
- `lab_tests`
- `lab_test_parameters`
- `lab_orders`
- `lab_order_items`
- `lab_specimens`
- `lab_results`
- `lab_result_items`
- `lab_result_validations`

Hasil laboratorium harus menyimpan nilai, satuan, rentang referensi, waktu pemeriksaan, dan identitas pemeriksa atau validator sesuai kebutuhan pemeriksaan.

`[BARU v2]` Tambahan: pemeriksaan yang dirujuk ke laboratorium mitra (order keluar, hasil masuk dilampirkan), label spesimen berbarcode, notifikasi nilai kritis ke dokter peminta, dan pemetaan kode pemeriksaan ke LOINC bila tersedia untuk SATUSEHAT.

### B. Farmasi

Farmasi mengelola resep, verifikasi, dispensing, dan penyerahan obat.

Workflow:

1. Dokter membuat resep.
2. Resep masuk ke antrean farmasi.
3. Apoteker atau petugas berwenang melakukan verifikasi.
4. Ketersediaan stok diperiksa.
5. Obat disiapkan.
6. Dispensing dicatat.
7. Obat diserahkan.
8. Transaksi dikirim ke Billing.
9. Pengeluaran persediaan dicatat.

Entitas:

- `prescriptions`
- `prescription_items`
- `pharmacy_verifications`
- `pharmacy_dispenses`
- `pharmacy_dispense_items`
- `medication_catalogs`
- `prescription_compounds` `[BARU v2]` (racikan: bahan, jumlah, bentuk sediaan, jasa racik)
- `controlled_drug_registers` `[BARU v2]`
- `pharmacy_returns` `[BARU v2]`

`[REVISI v2]` `drug_batches` dihapus. Seluruh batch disimpan di `inventory_batches` (Gudang); Farmasi hanya merujuk.

### B2. Kekhususan farmasi klinik Indonesia `[BARU v2]`

- **Narkotika/psikotropika/prekursor:** surat pesanan khusus per jenis (narkotika satu item per surat), penyimpanan di lemari terkunci, register mutasi per pergerakan, penyerahan hanya dengan resep, laporan bulanan SIPNAP (umumnya paling lambat tanggal 10 bulan berikutnya). Sistem menyiapkan data dan checklist; apoteker yang mengirim.
- **Apoteker penanggung jawab dan SIPA** tercatat sebagai praktisi; verifikasi resep memerlukan peran apoteker aktif `[V]`.
- **Racikan dan jasa racik** sebagai komponen tarif; **obat bawa pulang** pada rawat inap.
- **Kode obat:** pemetaan produk ke KFA untuk SATUSEHAT.
- **BHP pada tindakan:** tindakan memiliki daftar bahan habis pakai (`procedure_consumables`) yang otomatis membuat pengeluaran stok dan biaya. Di v1 hanya dispensing yang mengurangi stok.
- **Pengadaan** hanya dari pemasok sah (PBF/penyalur resmi) dengan faktur dan surat pesanan.

### C. Gudang Obat dan Persediaan

Mengelola stok obat dan BHP.

Fitur:

- Master produk.
- Batch dan nomor lot.
- Kedaluwarsa.
- Penerimaan barang.
- Pengeluaran barang.
- Transfer stok.
- Stock opname.
- Penyesuaian stok.
- Kartu stok.
- Minimum stock.
- FEFO/FIFO sesuai kebijakan produk.

Entitas:

- `products`
- `product_categories`
- `product_units`
- `warehouses`
- `warehouse_locations`
- `inventory_batches`
- `inventory_movements`
- `inventory_adjustments`
- `stock_opnames`
- `stock_opname_items`

Gunakan inventory movement sebagai catatan pergerakan stok yang dapat ditelusuri. Jangan hanya menyimpan angka stok akhir tanpa histori.

`[BARU v2]` Tambahan: konversi satuan (`product_uom_conversions`: boks, strip, tablet), lapisan biaya (`inventory_cost_layers`) untuk nilai persediaan (metode ditetapkan kebijakan akuntansi: rata-rata/FIFO), barang konsinyasi dari pemasok, serta transfer antar gudang/cabang yang membawa batch, tanggal kedaluwarsa, dan biaya. FEFO diterapkan untuk pemilihan batch keluar.

## 2.5 Billing & Financial Operations

Billing merupakan pusat penghitungan seluruh biaya pelayanan.

Semua unit yang menghasilkan biaya harus mengirimkan transaksi ke Billing Engine.

Sumber biaya:

- Konsultasi.
- Tindakan.
- Laboratorium.
- Obat.
- Kamar rawat inap.
- Jasa pelayanan.
- BHP.
- Layanan tambahan.

Fitur:

- Katalog tarif.
- Aturan harga.
- Tagihan.
- Item tagihan.
- Penjamin.
- Pembayaran.
- Alokasi pembayaran.
- Piutang pasien.
- Refund.
- Diskon atau penyesuaian dengan otorisasi.
- Cetak invoice dan kuitansi.
- `[BARU v2]` Pembayar jamak per episode (mandiri, JKN, asuransi, perusahaan).
- `[BARU v2]` Kapitasi dan klaim non-kapitasi; surat jaminan (LOG), plafon, co-pay.
- `[BARU v2]` Deposit pasien; paket layanan, kontrak perusahaan, membership prabayar.
- `[BARU v2]` Sesi kasir, tutup shift, selisih kas; metode bayar tunai, transfer/VA, QRIS, EDC, e-wallet; pembulatan tunai.

Entitas:

- `service_catalogs`
- `service_prices`
- `price_lists`
- `service_transactions`
- `service_transaction_items`
- `invoices`
- `invoice_items`
- `payers` `[REVISI v2]` (generalisasi `guarantors`; tipe: self, bpjs, insurer, corporate, program)
- `payer_contracts` `[BARU v2]`
- `patient_coverages` `[REVISI v2]` (menggantikan `patient_coverage`)
- `coverage_eligibility_checks` `[BARU v2]`
- `guarantee_letters` `[BARU v2]`
- `invoice_guarantors` (dipertahankan untuk pembagian tanggungan per invoice)
- `payments`
- `payment_allocations`
- `refunds`
- `billing_adjustments`
- `billing_accounts` `[BARU v2]`
- `credit_notes` `[BARU v2]`
- `capitation_runs`, `capitation_run_items` `[BARU v2]`
- `claim_batches`, `claim_items` `[BARU v2]`
- `patient_deposits` `[BARU v2]`
- `service_packages`, `package_enrollments` `[BARU v2]`
- `cashier_sessions`, `cash_drawer_counts` `[BARU v2]`
- `payment_methods` `[BARU v2]`

**Penting:** Billing menghitung kewajiban pembayaran. Billing bukan tempat mencatat penerimaan uang dan bukan pengganti jurnal akuntansi.

### Model pembayar `[REVISI v2]`

Pelayanan di Indonesia sering dibiayai lebih dari satu pihak. Jenis pembayar:

| Pembayar | Ciri | Konsekuensi desain |
|---|---|---|
| Mandiri | Bayar sendiri | Invoice ke pasien |
| JKN (BPJS) | Kapitasi bulanan per peserta terdaftar + klaim non-kapitasi per pelayanan | Tagihan pasien Rp0; pendapatan kapitasi tingkat periode; klaim berbatch |
| Asuransi swasta/TPA | Surat jaminan, plafon, co-pay/excess, item non-covered | Invoice ke penjamin dan ke pasien; penolakan item direalokasi |
| Perusahaan/kontrak | MCU, klinik perusahaan, invoice berkala | Kontrak, paket, piutang dengan umur |
| Program lain | Mis. penjamin kecelakaan lalu lintas `[V]` | Pembayar tipe `program` |
| Prabayar | Paket/membership/deposit | Liabilitas atau pendapatan diterima di muka |

Prinsip:
1. Satu episode (visit atau admission) memiliki satu `billing_account`. Item layanan dialokasikan ke pembayar; satu invoice dibentuk per pembayar.
2. Layanan peserta JKN dalam kapitasi dicatat sebagai `service_transaction` dengan `coverage_type = capitation` dan nilai biaya internal untuk analitik; tidak ada pendapatan per layanan.
3. Layanan non-kapitasi dikumpulkan ke `claim_batches` bulanan (draft → verified → submitted → paid/disputed).
4. Penolakan item oleh penjamin menghasilkan penyesuaian atau realokasi ke pasien dengan otorisasi.
5. Deposit pasien adalah liabilitas, bukan pendapatan.
6. Pembulatan tunai dicatat sebagai baris penyesuaian sendiri.
7. Tarif ber-tanggal-berlaku; harga yang sudah ditagih tidak berubah saat tarif diperbarui.
8. Kode pajak pada item katalog menentukan perlakuan PPN (2.7).
9. IGD: layanan dimulai tanpa syarat pembayaran.

## 2.6 Accounting & Finance

Accounting mengelola pencatatan keuangan berdasarkan prinsip accrual dan double-entry.

### Fitur

- Chart of Accounts.
- Jurnal umum.
- Jurnal otomatis.
- Buku besar.
- Kas dan bank.
- Piutang.
- Utang.
- Pendapatan.
- Beban.
- Persediaan dan HPP.
- Aset tetap.
- Penyusutan.
- Laporan keuangan.
- Tutup periode.
- Cost center.

Entitas:

- `accounts`
- `account_categories`
- `accounting_periods`
- `journal_entries`
- `journal_entry_lines`
- `cash_accounts`
- `cash_transactions`
- `bank_reconciliations`
- `bank_statement_lines` `[BARU v2]`
- `account_mapping_rules`, `account_mapping_rule_lines` `[REVISI v2]`
- `intercompany_accounts` `[BARU v2]`

`[REVISI v2]` **Pemilik tabel.** `supplier_invoices`, `supplier_invoice_payments`, `expenses`, `fixed_assets`, dan `asset_depreciations` dimiliki Business Management. Accounting hanya menerima event dan membuat jurnal; Accounting tidak menulis ke tabel tersebut.

### Contoh Chart of Accounts

| Kode | Akun | Kategori |
|---|---|---|
| 1000 | Kas dan Bank | Aset |
| 1050 | Dana Transit Pembayaran Digital (QRIS/EDC belum settle) | Aset |
| 1100 | Piutang Pasien | Aset |
| 1150 | Piutang Asuransi/Perusahaan | Aset |
| 1160 | Piutang BPJS Kesehatan | Aset |
| 1170 | Pendapatan Belum Ditagih (rawat inap berjalan) | Aset |
| 1200 | Persediaan Obat | Aset |
| 1210 | Persediaan BHP dan Alkes | Aset |
| 1250 | PPN Masukan | Aset |
| 1300 | Peralatan Medis | Aset |
| 2000 | Utang Supplier | Liabilitas |
| 2100 | Utang Jasa Medis | Liabilitas |
| 2200 | Utang PPN (PPN Keluaran) | Liabilitas |
| 2250 | Utang PPh 21 | Liabilitas |
| 2300 | Uang Muka Pasien (Deposit) | Liabilitas |
| 2350 | Pendapatan Diterima di Muka (Paket/Membership) | Liabilitas |
| 2400 | Utang Antar Entitas | Liabilitas |
| 3000 | Modal Pemilik | Ekuitas |
| 4000 | Pendapatan Konsultasi | Pendapatan |
| 4100 | Pendapatan Tindakan | Pendapatan |
| 4200 | Pendapatan Farmasi | Pendapatan |
| 4300 | Pendapatan Laboratorium | Pendapatan |
| 4400 | Pendapatan Kapitasi JKN | Pendapatan |
| 4500 | Pendapatan Klaim Non-Kapitasi JKN | Pendapatan |
| 4600 | Pendapatan Rawat Inap/Kamar | Pendapatan |
| 4900 | Diskon dan Potongan Pendapatan | Kontra pendapatan |
| 5000 | Beban Pokok Penjualan | Beban |
| 5050 | Beban Obat dan BHP Pelayanan Kapitasi | Beban |
| 5100 | Beban Gaji | Beban |
| 5150 | Beban Jasa Medis | Beban |
| 5200 | Beban Operasional | Beban |
| 5300 | Beban Utilitas | Beban |
| 5400 | Beban Penyusutan | Beban |
| 5500 | Beban Biaya Transaksi Pembayaran | Beban |
| 5900 | Selisih Kas dan Pembulatan | Beban |

Akun di atas merupakan contoh awal, bukan COA final. Struktur harus dapat dikonfigurasi.

## 2.7 Business Management

Modul untuk mengelola aktivitas bisnis di luar pelayanan pasien.

### Purchasing dan Supplier

- Supplier.
- Permintaan pembelian.
- Purchase order.
- Penerimaan barang.
- Invoice supplier.
- Retur pembelian.
- Pembayaran utang.

Entitas:

- `suppliers`
- `purchase_requests`
- `purchase_orders`
- `purchase_order_items`
- `purchase_receipts`
- `purchase_receipt_items`
- `supplier_invoices`
- `supplier_invoice_items`
- `supplier_invoice_payments`

`[BARU v2]` Pemasok obat harus pemasok sah (PBF/penyalur resmi); pembelian narkotika/psikotropika memakai surat pesanan khusus yang ditandatangani apoteker penanggung jawab. Faktur pajak masukan disimpan bila klinik PKP. Konsinyasi dan retur pembelian memengaruhi `inventory_movements` dan jurnal.

### Expense Management

- Pengeluaran operasional.
- Pengajuan biaya.
- Persetujuan biaya.
- Bukti pengeluaran.
- Pembayaran biaya.

Entitas:

- `expense_categories`
- `expense_requests`
- `expenses`
- `expense_approvals`

### Fixed Asset

- Register aset.
- Akuisisi aset.
- Penempatan aset.
- Penyusutan.
- Mutasi.
- Penghapusan aset.

### Payroll

- Data pegawai.
- Komponen gaji.
- Periode payroll.
- Perhitungan gaji.
- Pembayaran gaji.
- Jurnal payroll.
- `[BARU v2]` Iuran BPJS Ketenagakerjaan dan BPJS Kesehatan (porsi pemberi kerja dan pekerja).
- `[BARU v2]` PPh 21 dan bukti potong.
- `[BARU v2]` THR (sesuai ketentuan ketenagakerjaan) sebagai akrual bulanan; lembur dan shift 24 jam.
- `[BARU v2]` Jasa medis dihitung di modul 2.8, bukan payroll.

### Tax Management

- Kategori pajak.
- Konfigurasi tarif dan perlakuan pajak.
- Rekap transaksi.
- Dokumen pendukung.
- Laporan untuk proses perpajakan.

### Tax Management `[REVISI v2]`

Prinsip tetap: tarif dan perlakuan pajak tidak dikunci di kode dan dikonfirmasi dengan konsultan pajak. Di Indonesia, perlakuan pajak berbeda dalam satu transaksi:

| Objek | Perlakuan umum | Dampak desain |
|---|---|---|
| Jasa pelayanan kesehatan medis (konsultasi, tindakan, rawat jalan/inap, lab) | PPN dibebaskan (PP 49/2022 Pasal 11) | `tax_code = PPN_DIBEBASKAN`; tidak ada baris PPN |
| Penyerahan obat | Tetap BKP, tidak ikut pembebasan jasa medis | `tax_code = PPN_BKP`; baris PPN keluaran |
| Layanan lain (mis. estetika) | Perlu klasifikasi; kecantikan pernah dijelaskan DJP sebagai kena PPN `[V]` | Kode pajak per item dengan persetujuan |
| Status PKP | Wajib dikukuhkan bila peredaran usaha > Rp4,8 miliar | `tax_profiles` per badan usaha |
| PPN masukan | Dapat dikreditkan hanya bila PKP; bila non-PKP biasanya menjadi bagian harga perolehan `[V]` | Aturan posting pembelian dua varian |
| PPh 21 | Gaji pegawai dan jasa dokter; skema pegawai vs non-pegawai berbeda `[V]` | Klasifikasi di praktisi dan payroll |
| PPh badan/final | Bergantung bentuk usaha dan omzet `[V]` | Sistem menyediakan rekap omzet bulanan |
| Dokumen | e-Faktur/Coretax, bukti potong | Ekspor data; bukan filing otomatis |

Entitas: `tax_codes`, `tax_rates` (ber-tanggal-berlaku), `tax_profiles`, `tax_transactions`, `tax_documents`.

## 2.8 Practitioner & Remuneration `[BARU v2]`

Memisahkan "orang yang bertugas" dari "akun login", memastikan hanya praktisi berizin yang bertugas, dan menghitung jasa medis.

### Fitur
- Master praktisi (dokter, dokter gigi, bidan, perawat, apoteker, analis lab), termasuk praktisi mitra tanpa akun login.
- Dokumen legalitas: STR (seumur hidup menurut UU 17/2023), SIP per tempat praktik (SIP ke-1 s.d. ke-3), SIPA apoteker; masa berlaku, lokasi, berkas.
- Jadwal praktik, kuota, cuti, dan pengganti.
- Penugasan praktisi ke fasilitas/unit dengan validasi legalitas.
- Perjanjian jasa medis (persentase/nominal per layanan, per dokter, per jenis pembayar, ber-tanggal-berlaku).
- Akrual jasa medis, penahanan sampai pembayaran diterima (kebijakan), pembayaran, potongan pajak.

### Entitas
`practitioners`, `practitioner_licenses`, `practitioner_assignments`, `practitioner_schedules`, `schedule_exceptions`, `fee_agreements`, `fee_agreement_rules`, `fee_accruals`, `fee_payout_batches`, `fee_payout_items`

### Aturan penting
1. Penugasan dan jadwal ditolak jika tidak ada SIP aktif untuk fasilitas tersebut. Mempekerjakan nakes tanpa SIP berisiko pidana `[V pasal]`.
2. Pengingat kedaluwarsa SIP/SIPA (mis. 90/60/30 hari) ke penanggung jawab klinik.
3. Satu praktisi dapat punya hingga tiga SIP; lokasi SIP dicocokkan dengan fasilitas.
4. Jasa medis diakui sebagai beban dan utang saat layanan diberikan (accrual), bukan saat dibayar.
5. Aturan bagi hasil ber-tanggal-berlaku; perubahan tidak menulis ulang akrual lama.
6. Perlakuan pajak penghasilan dokter ditentukan konsultan pajak; sistem menyimpan klasifikasi dan menghasilkan rekap `[V]`.

---

## 2.9 Integration & Compliance Hub `[BARU v2]`

Mengisolasi seluruh komunikasi eksternal dan kewajiban kepatuhan. Setiap integrasi berupa adapter: menerima event dari outbox, menerjemahkan, mengirim asinkron, mencatat hasil, dan mengulang bila gagal.

### A. SATUSEHAT (Kemenkes)

| Domain Clinic ERP | Resource FHIR | Terminologi |
|---|---|---|
| Fasilitas | Organization | ID organisasi dari SATUSEHAT |
| Unit, ruang, bed | Location | |
| Praktisi | Practitioner | |
| Pasien | Patient (via NIK → IHS Number) | NIK |
| Visit, encounter, admission | Encounter | |
| Diagnosis | Condition | ICD-10 |
| Tanda vital, hasil lab | Observation (+ ServiceRequest, Specimen, DiagnosticReport untuk lab) | LOINC bila ada |
| Tindakan | Procedure | KPTL/ICD-9-CM `[V]` |
| Resep, dispensing | Medication, MedicationRequest, MedicationDispense | KFA |

Daftar resource wajib per jenis fasilitas dan versinya diambil dari dokumentasi resmi pada Tahap 0 `[V]`.

Pola teknis: OAuth2 client credentials dengan cache token; `external_identifiers` memetakan ID internal ↔ ID SATUSEHAT; urutan kirim mengikuti ketergantungan (Patient → Encounter → Condition/Observation/Procedure → Medication*); respons duplikat ditangani dengan baca lalu perbarui; retry berjenjang, dead-letter, dan dasbor "belum terkirim/gagal" per encounter; validasi terminologi lokal sebelum kirim.

### B. BPJS Kesehatan (FKTP), opsional per fasilitas
- **PCare:** kunjungan, diagnosis, tindakan, obat, rujukan, program penyakit kronis `[V]`.
- **Antrean Mobile JKN:** bridging baru dapat dilakukan setelah bridging PCare selesai; mensyaratkan jadwal dan kuota dokter.
- **i-Care JKN:** tampilan riwayat pelayanan peserta `[V]`.
- Bridging diajukan oleh klinik sendiri ke BPJS (consumer ID, UAT, monitoring). Ini tugas implementasi yang berdurasi dan bergantung pada pihak luar, bukan asumsi.
- Kapitasi dan non-kapitasi: lihat 2.5, 3.7, 6.7.

### C. SIPNAP (narkotika/psikotropika)
Data laporan bulanan disusun dari register mutasi golongan khusus; apoteker meninjau dan mengirim. Tenggat dikonfigurasi di `facility_policies`.

### D. Pembayaran digital
QRIS, EDC, transfer/VA, e-wallet; rekonsiliasi settlement ke `payments` dan biaya transaksi.

### E. Notifikasi
WhatsApp/SMS pengingat jadwal dan pemberitahuan hasil, hanya dengan consent.

### F. Pajak
Ekspor data untuk e-Faktur/Coretax dan bukti potong sesuai arahan konsultan; bukan pelaporan otomatis `[V]`.

### Entitas integrasi
`integration_connections`, `integration_credentials` (terenkripsi), `external_identifiers`, `integration_jobs`, `integration_attempts`, `integration_dead_letters`, `terminology_systems`, `terminology_codes`, `terminology_mappings`

### G. Kepatuhan privasi (UU PDP)
- `consent_records`: tujuan, versi teks, kanal, penarikan.
- `data_subject_requests`: akses, koreksi, pembatasan, penghapusan; tenggat dipantau (ringkasan UU PDP menyebut 3x24 jam) `[V]`.
- `security_incidents`: deteksi → penilaian → notifikasi tertulis ke subjek data dan lembaga berwenang paling lambat 3x24 jam `[V]`.
- `break_glass_access`: akses darurat dengan alasan, peninjauan oleh penanggung jawab.
- `data_retention_policies`: retensi RME 25 tahun `[V]` mengungguli permintaan penghapusan selama kewajiban retensi berlaku.
- Pembukaan rekam medis ke pihak ketiga (asuransi, perusahaan, aparat) hanya dengan dasar sah dan tercatat.
- Penanggung jawab pelindungan data pribadi ditetapkan sesuai skala `[V]`.

---

# 3. Workflow End-to-End

## 3.1 Pasien rawat jalan

1. Pasien datang.
2. Loket mencari atau mendaftarkan pasien.
3. Kunjungan dibuat.
4. Unit Poli dipilih.
5. Nomor antrean diterbitkan.
6. Encounter dibuat saat pelayanan klinis dimulai.
7. Dokter melakukan pemeriksaan.
8. SOAP dan diagnosis disimpan.
9. Dokter dapat membuat tindakan, resep, atau permintaan laboratorium.
10. Tindakan dan layanan yang berbiaya dikirim ke Billing.
11. Laboratorium dan Farmasi memproses order masing-masing.
12. Tagihan diperbarui.
13. Pasien melakukan pembayaran di Kasir.
14. Pembayaran dicatat.
15. Billing mengirim event pengakuan layanan; Accounting Engine membentuk jurnal pengakuan pendapatan/piutang sesuai mapping dan kode pajak.
16. Pembayaran dialokasikan dan diteruskan sebagai event pembayaran ke Accounting Engine.
17. Kunjungan ditutup sesuai workflow.
18. Data klinis dikirim ke SATUSEHAT melalui Integration Hub secara asinkron; status pengiriman tampak pada encounter.

## 3.2 Pasien IGD

1. Pasien datang.
2. Registrasi darurat dibuat.
3. Triase dilakukan.
4. Encounter IGD dibuat.
5. Pemeriksaan dan tindakan dilakukan.
6. Permintaan lab atau resep diterbitkan bila diperlukan.
7. Monitoring dan observasi dilakukan.
8. Disposisi ditetapkan.
9. Jika rawat inap, admission dibuat dan pasien ditempatkan pada bed.
10. Jika pulang atau dirujuk, proses administrasi dan dokumentasi diselesaikan sesuai ketentuan operasional.

## 3.3 Rawat inap

1. Admission dibuat.
2. Bed dialokasikan.
3. Asesmen awal dilakukan.
4. Dokter membuat instruksi medis.
5. Perawat melakukan monitoring dan dokumentasi.
6. Obat diberikan dan dicatat melalui Medication Administration Record.
7. Tindakan dan pemeriksaan penunjang dilakukan.
8. Biaya kamar dan layanan dikirim ke Billing.
9. Perpindahan bed dicatat.
10. Dokter membuat resume dan keputusan pulang.
11. Admission ditutup.
12. Tagihan akhir direkonsiliasi.
13. Pembayaran dan pencatatan akuntansi diproses.

## 3.4 Laboratorium

1. Order diterima.
2. Petugas memverifikasi order.
3. Spesimen diambil.
4. Spesimen diberi identitas dan status.
5. Pemeriksaan dilakukan.
6. Hasil dimasukkan.
7. Hasil divalidasi.
8. Hasil dipublikasikan ke rekam medis.
9. Status order diperbarui.

## 3.5 Farmasi

1. Resep diterima.
2. Verifikasi resep dilakukan.
3. Ketersediaan obat diperiksa.
4. Batch obat dipilih.
5. Dispensing dilakukan.
6. Stok berkurang.
7. Biaya obat dikirim ke Billing.
8. Obat diserahkan.
9. Riwayat dispensing tersimpan.

## 3.6 Purchasing sampai pembayaran supplier

1. Permintaan pembelian dibuat.
2. Purchase order disetujui.
3. Barang diterima.
4. Kuantitas dan kondisi diverifikasi.
5. Persediaan bertambah.
6. Invoice supplier dicatat.
7. Utang supplier terbentuk jika pembelian kredit.
8. Pembayaran dilakukan.
9. Accounting Engine membuat jurnal terkait.

## 3.7 Pasien JKN di FKTP (klinik pratama) `[BARU v2]`

1. Peserta mengambil antrean via Mobile JKN atau datang langsung; sistem menerima antrean (bridging) atau membuat tiket manual.
2. Loket memverifikasi NIK, status kepesertaan, dan FKTP terdaftar; hasil pengecekan disimpan.
3. Visit dibuat dengan pembayar JKN; encounter berjalan normal.
4. Layanan dalam kapitasi dicatat dengan `coverage_type = capitation` (tagihan pasien Rp0); layanan non-kapitasi ditandai dapat diklaim.
5. Kasir hanya memungut item yang memang bukan tanggungan JKN sesuai ketentuan `[V]`.
6. Data pelayanan dikirim ke PCare; error terlihat dan dapat dikoreksi sebelum batas klaim.
7. Akhir bulan: `capitation_runs` mencocokkan peserta terdaftar dengan pembayaran kapitasi; `claim_batches` non-kapitasi disusun, diverifikasi, dikirim.
8. Pembayaran BPJS diterima, dialokasikan ke piutang BPJS, dijurnal.
9. Rujukan ke FKRTL dan rujuk balik dicatat di `visit_referrals` dan diteruskan ke PCare.

## 3.8 Pasien asuransi swasta atau perusahaan `[BARU v2]`

1. Loket memverifikasi kartu/kontrak dan menerima surat jaminan (LOG) dengan plafon.
2. Layanan berjalan; item dialokasikan ke penjamin atau pasien (co-pay, excess, non-covered).
3. Penjamin menerima invoice/klaim; pasien membayar bagiannya di kasir.
4. Penolakan item direalokasi dengan otorisasi.
5. Pembayaran penjamin dialokasikan; piutang dipantau menurut umur.
6. Untuk MCU perusahaan, hanya ringkasan yang disepakati dalam consent yang dibagikan.

## 3.9 Remunerasi dokter `[BARU v2]`

1. Layanan diberikan dan `fee_accruals` dibuat berdasarkan perjanjian berlaku.
2. Akrual ditahan sampai kondisi rilis (mis. pembayaran diterima) sesuai kebijakan.
3. Periode ditutup; `fee_payout_batches` disusun dan disetujui.
4. Pajak dipotong sesuai klasifikasi praktisi; pembayaran dilakukan.
5. Jurnal beban, utang jasa medis, utang pajak, kas dibuat oleh Accounting Engine.

## 3.10 Narkotika dan psikotropika `[BARU v2]`

1. Resep diverifikasi apoteker.
2. Obat diambil dari lemari khusus; dispensing mencatat batch dan register mutasi.
3. Pengadaan memakai surat pesanan khusus.
4. Akhir bulan: data laporan SIPNAP disusun, ditinjau, dikirim sebelum tenggat.

## 3.11 Insiden data pribadi `[BARU v2]`

1. Insiden terdeteksi atau dilaporkan; `security_incidents` dibuka.
2. Penilaian dampak dan pembatasan.
3. Notifikasi tertulis ke subjek data dan lembaga berwenang paling lambat 3x24 jam `[V]`.
4. Perbaikan, tinjauan, dan penutupan insiden.

## 3.12 Downtime sistem `[BARU v2]`

1. Antrean manual dan formulir kertas cadangan disiapkan per unit.
2. Layanan darurat tetap berjalan.
3. Setelah pulih, data diinput susulan dengan penanda `entered_late`, alasan, dan penginput.
4. Event keluar (outbox) dikirim ulang secara idempoten; rekonsiliasi harian memeriksa kelengkapan.
5. Target RPO/RTO ditetapkan di Tahap 0; backup diuji pulih berkala.

---

# 4. Rancangan Domain dan Entitas Database

## 4.1 Relasi inti pasien dan pelayanan

```text
patients
  └── patient_visits
        ├── queue_tickets
        ├── visit_referrals
        └── encounters
              ├── clinical_notes
              ├── encounter_diagnoses
              ├── medical_procedures
              ├── prescriptions
              ├── lab_orders
              └── service_transactions

patient_visits
  └── inpatient_admissions   (visit_type = inpatient; asal: encounter IGD/Poli)
        ├── bed_assignments
        ├── inpatient_rounds
        ├── nursing_notes
        ├── patient_observations
        ├── medication_administrations
        └── discharge_summaries

billing_accounts (satu per visit/admission)
  └── service_transactions → invoices (per pembayar) → payments
```

### Pembedaan entitas penting

**Patient:** identitas orang yang menerima pelayanan.

**Patient Visit:** satu episode kedatangan atau kunjungan administratif pasien.

**Encounter:** satu episode pelayanan klinis pada unit tertentu.

**Inpatient Admission:** satu episode rawat inap yang berlangsung secara longitudinal.

Satu kunjungan dapat memiliki beberapa encounter, misalnya pasien datang ke Poli Umum kemudian dirujuk internal ke Poli Gigi.

Satu admission rawat inap dapat memiliki banyak catatan klinis tanpa harus membuat admission baru setiap hari.

## 4.2 Struktur tabel inti

### A. Patient

`patients`

```text
id
organization_id
registered_facility_id
medical_record_number
full_name
gender
birth_date
birth_place
blood_type
marital_status
religion
occupation
education_level
nationality
phone
email
created_at
updated_at
```

`patient_identifiers`

```text
id
patient_id
identifier_type
identifier_value
is_primary
verified_at
created_at
```

Nomor rekam medis harus unik dalam `organization_id`. `[REVISI v2]` Nilai `identifier_type`: `NIK`, `BPJS_NUMBER`, `IHS_NUMBER`, `PASSPORT`, `KIA`, `NIK_MOTHER_REF`, `TEMP_ID`. NIK disimpan terenkripsi dan dicari melalui hash. Pasien dapat digabung (merge) dengan jejak audit.

### B. Service Unit

`service_units`

```text
id
parent_id
code
name
service_unit_type_id
is_active
configuration
created_at
updated_at
```

`service_unit_modules`

```text
id
service_unit_id
module_code
configuration
is_enabled
```

`service_unit_users`

```text
id
service_unit_id
user_id
assignment_role
is_active
started_at
ended_at
```

### C. Visit dan Encounter

`patient_visits`

```text
id
facility_id
patient_id
visit_number
visit_type
visit_date
registration_status
appointment_id
primary_coverage_id
registered_by
created_at
updated_at
```

`encounters`

```text
id
patient_visit_id
patient_id
service_unit_id
encounter_number
encounter_type
attending_user_id
started_at
ended_at
status
parent_encounter_id
created_at
updated_at
```

`encounter_diagnoses`

```text
id
encounter_id
diagnosis_code_system
diagnosis_code
diagnosis_name
diagnosis_type
is_primary
recorded_by
created_at
```

`clinical_notes`

```text
id
encounter_id
note_type
subjective
objective
assessment
plan
status
author_id
signed_at
created_at
updated_at
```

Catatan yang telah ditandatangani sebaiknya tidak ditimpa tanpa jejak. Koreksi harus melalui mekanisme addendum atau versi baru sesuai kebijakan klinis.

### D. Rawat Inap

`inpatient_admissions`

```text
id
facility_id
patient_id
patient_visit_id
origin_encounter_id
admission_number
admission_date
discharge_date
admission_diagnosis
status
attending_user_id
created_at
updated_at
```

`beds`

```text
id
room_id
bed_code
status
is_active
```

`bed_assignments`

```text
id
inpatient_admission_id
bed_id
started_at
ended_at
assigned_by
reason
```

Simpan histori penempatan bed. Jangan hanya memperbarui `bed_id` pada admission karena histori perpindahan diperlukan.

### E. Laboratorium

`lab_orders`

```text
id
encounter_id
patient_id
ordering_user_id
ordered_at
priority
status
```

`lab_order_items`

```text
id
lab_order_id
lab_test_id
status
```

`lab_results`

```text
id
lab_order_item_id
result_status
performed_at
validated_by
validated_at
published_at
```

`lab_result_items`

```text
id
lab_result_id
parameter_id
result_value
result_text
unit
reference_range
abnormal_flag
```

### F. Farmasi dan Persediaan

`prescriptions`

```text
id
encounter_id
prescriber_id
prescription_number
prescribed_at
status
```

`prescription_items`

```text
id
prescription_id
product_id
dosage
frequency
duration
quantity
instruction
```

`pharmacy_dispenses`

```text
id
prescription_id
dispensed_by
dispensed_at
status
```

`pharmacy_dispense_items`

```text
id
pharmacy_dispense_id
prescription_item_id
product_id
batch_id
quantity
```

`inventory_movements`

```text
id
warehouse_id
product_id
batch_id
movement_type
quantity_in
quantity_out
unit_cost
source_type
source_id
occurred_at
created_by
```

Untuk akurasi stok, pergerakan harus tercatat secara append-only atau dikoreksi dengan transaksi pembalik. Saldo stok dapat disimpan sebagai cache atau projection yang dapat direkonsiliasi dengan histori movement.

### G. Billing

`service_transactions`

```text
id
facility_id
patient_id
patient_visit_id
admission_id
encounter_id
billing_account_id
service_unit_id
source_type
source_id
idempotency_key
status
occurred_at
```

`service_transaction_items`

```text
id
service_transaction_id
service_catalog_id
description
quantity
unit_price
discount_amount
gross_amount
net_amount
coverage_type
payer_id
performing_practitioner_id
tax_code_id
tax_amount
cost_amount
cost_center_id
```

`invoices`

```text
id
facility_id
patient_id
patient_visit_id
billing_account_id
payer_id
invoice_number
invoice_date
subtotal
discount_total
tax_total
rounding_amount
grand_total
outstanding_amount
status
```

`invoice_items`

```text
id
invoice_id
service_transaction_item_id
description
quantity
unit_price
total_amount
tax_code_id
tax_amount
```

`payments`

```text
id
facility_id
payment_number
payer_id
patient_id
cashier_session_id
payment_method_id
amount
fee_amount
paid_at
status
reference_number
```

`payment_allocations`

```text
id
payment_id
invoice_id
allocated_amount
```

Relasi ini memungkinkan satu invoice dibayar beberapa kali dan satu pembayaran dialokasikan ke beberapa invoice jika kebijakan bisnis mengizinkan.

### G2. Pembayar, Coverage, Kapitasi, Klaim, Kasir `[BARU v2]`

`billing_accounts`
```text
id, facility_id, patient_id, patient_visit_id, admission_id (nullable), status, opened_at, closed_at
```

`payers`
```text
id, organization_id, payer_type (self|bpjs|insurer|corporate|program), name, tax_id, is_active
```

`payer_contracts`
```text
id, payer_id, facility_id, contract_number, valid_from, valid_to, price_list_id, credit_term_days, coverage_rules (json)
```

`patient_coverages`
```text
id, patient_id, payer_id, member_number, group_number, valid_from, valid_to, priority,
is_registered_primary_care (JKN), status, last_verified_at
```

`guarantee_letters`
```text
id, patient_coverage_id, patient_visit_id, admission_id, letter_number, issued_at,
limit_amount, used_amount, copay_rule (json), status, attachment_id
```

`capitation_runs`
```text
id, facility_id, payer_id, period (YYYY-MM), registered_members, rate_per_member,
expected_amount, received_amount, status
```

`claim_batches` / `claim_items`
```text
claim_batches: id, facility_id, payer_id, period, status (draft|verified|submitted|paid|disputed), submitted_at
claim_items:   id, claim_batch_id, service_transaction_item_id, claimed_amount, approved_amount, rejection_reason, status
```

`patient_deposits`
```text
id, patient_id, billing_account_id, amount, used_amount, refunded_amount, status, received_payment_id
```

`cashier_sessions`
```text
id, facility_id, cashier_user_id, cash_account_id, opened_at, closed_at,
opening_cash, expected_cash, counted_cash, variance, status
```

`payment_methods`
```text
id, code, type (cash|transfer|va|qris|edc|ewallet), fee_rule (json), settlement_account_id
```

Status lunas dihitung dari alokasi, bukan diubah manual. Invoice dibuat per pembayar; satu episode dapat memiliki beberapa invoice.

### H. Accounting

`accounts`

```text
id
parent_id
code
name
account_type
normal_balance
is_active
```

`journal_entries`

```text
id
facility_id
legal_entity_id
journal_number
accounting_period_id
transaction_date
description
source_type
source_id
idempotency_key
status
reversal_of_id
posted_at
posted_by
created_by
```

`journal_entry_lines`

```text
id
journal_entry_id
account_id
cost_center_id
description
debit
credit
```

`account_mapping_rules` `[REVISI v2]` (menggantikan `account_mappings`)

```text
account_mapping_rules
  id, transaction_type, transaction_category, condition (json: coverage_type, tax_code, facility, dll.),
  effective_from, effective_to, priority, is_active

account_mapping_rule_lines
  id, rule_id, line_role (revenue|receivable|tax_output|tax_input|cogs|inventory|discount|deposit|...),
  account_id, side (debit|credit), amount_source, cost_center_rule
```

`accounting_periods`

```text
id
period_name
start_date
end_date
status
closed_at
closed_by
```

`cash_accounts`

```text
id
code
name
account_id
account_type
is_active
```

`cash_transactions`

```text
id
cash_account_id
transaction_type
amount
transaction_date
source_type
source_id
journal_entry_id
created_by
```

Jurnal harus mempunyai total debit dan kredit yang seimbang sebelum dapat diposting.

### I. Praktisi dan Jasa Medis `[BARU v2]`

```text
practitioners:          id, organization_id, user_id (nullable), full_name, profession_type, nik (terenkripsi), is_active
practitioner_licenses:  id, practitioner_id, license_type (STR|SIP|SIPA), license_number, issuing_authority,
                        facility_id (untuk SIP), practice_sequence (1-3), valid_from, valid_until (null bila seumur hidup),
                        status, attachment_id
practitioner_schedules: id, practitioner_id, service_unit_id, weekday, start_time, end_time, quota, valid_from, valid_to
fee_agreement_rules:    id, fee_agreement_id, service_catalog_id|category, basis (percent|fixed), value,
                        coverage_type, valid_from, valid_to
fee_accruals:           id, practitioner_id, service_transaction_item_id, amount,
                        status (accrued|released|paid|reversed), release_condition
```

### J. Fasilitas, Outbox, dan Integrasi `[BARU v2]`

```text
organizations:     id, name
legal_entities:    id, organization_id, name, tax_id, is_pkp
facilities:        id, organization_id, legal_entity_id, code, name, facility_type, license_number, timezone, region_code
facility_policies: id, facility_id, key, value, effective_from, effective_to
outbox_events:     id, event_type, aggregate_type, aggregate_id, payload, idempotency_key (unique),
                   occurred_at, status, attempts
processed_events:  consumer, idempotency_key (unique), processed_at, result_reference
external_identifiers: id, entity_type, entity_id, system, external_id, valid_from, metadata
integration_jobs:  id, connection_id, operation, entity_type, entity_id, status, attempts, next_attempt_at, last_error
terminology_codes: id, system (ICD10|KPTL|KFA|LOINC), code, display, status, version, valid_from, valid_to
```

Contoh `facility_policies`: `max_inpatient_beds`, `max_inpatient_days`, `cash_rounding`, `sipnap_due_day`, `record_retention_years`, `fee_hold_policy`.

## 4.3 Konvensi database

Rekomendasi teknis:

- Gunakan UUID atau ULID untuk primary key jika membutuhkan identitas yang aman untuk integrasi dan sinkronisasi; jika tidak, bigint juga layak.
- Gunakan foreign key pada relasi internal yang stabil.
- Gunakan `decimal` untuk nilai uang, bukan floating point.
- Simpan tanggal dan waktu secara konsisten, idealnya UTC di database dan tampilkan menurut timezone fasilitas (WIB, WITA, atau WIT).
- Gunakan status eksplisit dan validasi transisi status.
- Tambahkan `created_by`, `updated_by`, dan timestamp pada data penting.
- `[REVISI v2]` Gunakan `facility_id` pada semua tabel transaksi sejak awal dan `organization_id` pada master bersama; menambahkannya belakangan sangat mahal.
- `[BARU v2]` Parameter dengan tanggal berlaku (`effective_from`/`effective_to`): tarif, mapping akun, tarif pajak, kebijakan fasilitas, perjanjian jasa medis.
- `[BARU v2]` Data pribadi sensitif (NIK, kontak) dienkripsi di level kolom dan disamarkan pada tampilan yang tidak membutuhkannya.
- `[BARU v2]` Jangan menghapus fisik data klinis; masa retensi dan arsip diatur kebijakan `[V]`.
- Hindari soft delete untuk jurnal, pembayaran, pergerakan stok, dan catatan klinis yang sudah final.
- Gunakan tabel histori untuk perubahan data yang berdampak klinis atau finansial.

---

# 5. Aturan Bisnis dan Kontrol Audit

## 5.1 Identitas dan kunjungan

1. Pasien hanya memiliki satu identitas utama dalam cakupan fasilitas.
2. Pendaftaran tidak otomatis berarti pemeriksaan klinis sudah dimulai.
3. Visit dan encounter merupakan dua entitas berbeda.
4. Encounter harus terhubung ke pasien dan unit pelayanan.
5. Rujukan internal dicatat sebagai hubungan antar-encounter.
6. `[BARU v2]` NIK divalidasi dan dienkripsi; pasien tanpa NIK memakai identitas sementara dengan proses merge terjejak.
7. `[BARU v2]` Satu episode (visit/admission) memiliki satu billing account.

## 5.2 Dokumentasi klinis

1. Diagnosis dan SOAP memiliki identitas penulis.
2. Catatan final tidak boleh diubah tanpa histori.
3. Koreksi dilakukan melalui addendum atau versi baru.
4. Akses data klinis dibatasi berdasarkan kewenangan.
5. Riwayat tindakan, resep, dan hasil lab harus dapat ditelusuri ke encounter asal.

## 5.3 Laboratorium dan farmasi

1. Order harus memiliki peminta dan sumber encounter.
2. Hasil laboratorium final harus memiliki identitas validator sesuai kebijakan.
3. Dispensing tidak boleh melebihi jumlah yang diotorisasi tanpa mekanisme perubahan.
4. Batch dan kedaluwarsa harus tercatat.
5. Pengeluaran stok harus memiliki sumber transaksi.
6. Retur dan koreksi stok menggunakan movement pembalik atau penyesuaian yang terotorisasi.

## 5.4 Billing dan pembayaran

1. Satu sumber layanan tidak boleh ditagihkan dua kali.
2. Item invoice harus dapat ditelusuri ke sumber layanan.
3. Pembayaran tidak boleh melebihi saldo yang dapat dialokasikan kecuali terdapat mekanisme deposit atau kredit pasien.
4. Refund harus terhubung dengan pembayaran asal.
5. Diskon dan penyesuaian harus memiliki otorisasi.
6. Tagihan penjamin dipisahkan dari tanggungan pasien.
7. Status lunas dihitung dari saldo dan alokasi pembayaran, bukan diubah manual tanpa dasar transaksi.

## 5.5 Akuntansi

1. Sistem menggunakan double-entry.
2. Total debit harus sama dengan total kredit.
3. Jurnal posted tidak dapat diedit atau dihapus.
4. Koreksi dilakukan melalui reversal atau adjustment.
5. Setiap jurnal otomatis memiliki referensi sumber.
6. Periode yang telah ditutup tidak menerima posting normal.
7. Setiap transaksi harus menggunakan mapping akun yang aktif dan valid.
8. Laporan keuangan bersumber dari jurnal posted, bukan agregasi langsung tabel transaksi operasional.

## 5.6 Audit dan keamanan

Catat minimal:

- Pengguna.
- Waktu aktivitas.
- Unit kerja.
- Jenis aktivitas.
- Entitas yang berubah.
- Nilai sebelum dan sesudah untuk perubahan penting.
- Alasan perubahan.
- IP dan informasi perangkat bila relevan.
- Referensi persetujuan.

Audit log harus memiliki perlindungan terhadap modifikasi yang tidak berwenang.

## 5.7 Praktisi dan perizinan `[BARU v2]`

1. Praktisi tanpa SIP aktif pada fasilitas tidak dapat dijadwalkan atau menandatangani catatan klinis.
2. Apoteker penanggung jawab memerlukan SIPA aktif; verifikasi resep memerlukan peran apoteker aktif `[V]`.
3. Perubahan dokumen legalitas tercatat dengan histori.

## 5.8 JKN `[BARU v2]`

1. Status kepesertaan diverifikasi dan hasilnya disimpan pada kunjungan.
2. Layanan dalam kapitasi tidak menghasilkan pendapatan per layanan.
3. Klaim non-kapitasi hanya dari layanan yang valid dan belum pernah diklaim.
4. Koreksi data PCare dilakukan sebelum batas waktu klaim.

## 5.9 Privasi dan UU PDP `[BARU v2]`

1. Setiap tujuan pemrosesan non-pelayanan (pemasaran, berbagi ke pihak ketiga) memerlukan consent tercatat.
2. Akses darurat (break-glass) wajib beralasan dan ditinjau.
3. Permintaan hak subjek data dilacak sampai selesai dalam tenggat.
4. Insiden mengikuti alur 3.11.
5. Kewajiban retensi mengungguli permintaan penghapusan selama berlaku `[V]`.
6. Log akses data klinis tidak dapat diubah oleh pengguna biasa.

## 5.10 Pajak dan penagihan `[BARU v2]`

1. Setiap item katalog memiliki kode pajak berlaku; item tanpa kode pajak tidak dapat ditagihkan.
2. Perubahan kode pajak ber-tanggal-berlaku dan tidak mengubah invoice lama.
3. Koreksi invoice yang memuat pajak dilakukan lewat credit note dengan reversal pajak.
4. Piutang dipantau menurut umur per pembayar.

---

# 6. Integrasi Billing, Kasir, Akuntansi, dan Persediaan

## 6.1 Prinsip pemisahan

Terdapat enam tanggung jawab berbeda:

| Komponen | Fungsi |
|---|---|
| Service Module | Mencatat layanan yang diberikan |
| Billing Engine | Menghitung kewajiban biaya |
| Cashier/Payment | Mencatat uang yang diterima atau dibayarkan |
| Accounting Engine | Membuat jurnal dan laporan keuangan |
| Payer/Claim Management `[BARU v2]` | Mengelola kapitasi, klaim, LOG, penagihan penjamin |
| Integration Hub `[BARU v2]` | Mengirim dan menerima data ke sistem eksternal |

Tidak boleh ada modul Poli, Lab, atau Farmasi yang langsung membuat jurnal akuntansi.

## 6.2 Contoh transaksi konsultasi

Pasien mendapatkan konsultasi senilai Rp100.000.

Saat layanan sudah memenuhi aturan pengakuan pendapatan:

```text
Dr Piutang Pasien          Rp100.000
Cr Pendapatan Konsultasi   Rp100.000
```

Saat pasien membayar:

```text
Dr Kas/Bank                Rp100.000
Cr Piutang Pasien          Rp100.000
```

## 6.3 Contoh transaksi farmasi

Obat dijual Rp50.000 dengan HPP Rp30.000.

Saat obat diserahkan dan pendapatan diakui:

```text
Dr Piutang Pasien          Rp50.000
Cr Pendapatan Farmasi      Rp50.000
```

Pengakuan HPP:

```text
Dr Beban Pokok Penjualan   Rp30.000
Cr Persediaan Obat         Rp30.000
```

Saat pembayaran diterima:

```text
Dr Kas/Bank                Rp50.000
Cr Piutang Pasien          Rp50.000
```

Jika transaksi dibayar langsung dan kebijakan akuntansi mengizinkan pengakuan serta penerimaan bersamaan, pencatatan dapat dioptimalkan dengan tetap menjaga hasil jurnal yang benar.

## 6.4 Contoh pembelian obat secara kredit

Saat barang diterima dan kepemilikan/pengakuan persediaan memenuhi kebijakan:

```text
Dr Persediaan Obat         Rp1.000.000
Cr Utang Supplier          Rp1.000.000
```

Saat supplier dibayar:

```text
Dr Utang Supplier          Rp1.000.000
Cr Kas/Bank                Rp1.000.000
```

## 6.5 Arsitektur Accounting Engine

```text
Service Modules
      |
      v
Service Transactions
      |
      v
Billing Engine
      |
      v
Invoice / Receivable
      |
      v
Accounting Event
      |
      v
Account Mapping
      |
      v
Journal Engine
      |
      v
Journal Entries
      |
      v
General Ledger
      |
      v
Financial Reports
```

Sumber transaksi lain seperti pembayaran supplier, pengeluaran operasional, payroll, dan penyusutan juga mengirimkan event ke Accounting Engine.

## 6.6 Pola implementasi teknis

Gunakan pola transactional outbox untuk memastikan event keuangan tidak hilang ketika proses transaksi utama berhasil tetapi proses integrasi gagal.

Contoh:

1. Transaksi dispensing disimpan.
2. Inventory movement disimpan.
3. Service transaction dibuat.
4. Outbox event disimpan dalam transaksi database yang sama.
5. Worker memproses event.
6. Billing membuat invoice item.
7. Accounting Engine membuat jurnal sesuai mapping.

Setiap event harus memiliki idempotency key atau identitas sumber unik agar pemrosesan ulang tidak membuat tagihan atau jurnal ganda.

### 6.7 Kapitasi JKN `[BARU v2]` (angka ilustrasi)

6.000 peserta × Rp10.000 per bulan:
```text
Dr Piutang BPJS Kesehatan        Rp60.000.000
Cr Pendapatan Kapitasi JKN       Rp60.000.000
(saat diterima)
Dr Bank                          Rp60.000.000
Cr Piutang BPJS Kesehatan        Rp60.000.000
```
Pelayanan peserta dalam kapitasi tidak menghasilkan pendapatan; biaya obat/BHP yang keluar:
```text
Dr Beban Obat dan BHP Pelayanan Kapitasi   xxx
Cr Persediaan Obat / BHP                    xxx
```

### 6.8 Jasa medis dokter `[BARU v2]`

```text
(saat layanan)  Dr Beban Jasa Medis   Rp120.000   Cr Utang Jasa Medis    Rp120.000
(saat dibayar)  Dr Utang Jasa Medis   Rp120.000   Cr Utang PPh 21        X
                                                   Cr Kas/Bank            Rp120.000 − X
```
Nilai X mengikuti klasifikasi pajak praktisi `[V]`.

### 6.9 PPN obat dan pembelian `[BARU v2]`

Penjualan obat Rp50.000 oleh klinik PKP (tarif 11% ilustrasi; tarif/DPP dikonfigurasi `[V]`):
```text
Dr Piutang Pasien      Rp55.500
Cr Pendapatan Farmasi  Rp50.000
Cr PPN Keluaran        Rp5.500
```
Jasa medis: tanpa baris PPN (dibebaskan). Pembelian obat kredit Rp1.000.000 + PPN Rp110.000:
```text
PKP:      Dr Persediaan Obat Rp1.000.000 | Dr PPN Masukan Rp110.000 | Cr Utang Supplier Rp1.110.000
Non-PKP:  Dr Persediaan Obat Rp1.110.000 | Cr Utang Supplier Rp1.110.000     [V]
```

### 6.10 Deposit rawat inap `[BARU v2]`

Deposit Rp2.000.000, tagihan akhir Rp3.500.000:
```text
(terima deposit) Dr Kas 2.000.000 | Cr Uang Muka Pasien 2.000.000
(tagihan akhir, piutang sudah diakui) Dr Uang Muka Pasien 2.000.000 | Dr Kas 1.500.000 | Cr Piutang Pasien 3.500.000
```

### 6.11 Asuransi dengan co-pay `[BARU v2]`

Tagihan Rp1.000.000, LOG 80%:
```text
Dr Piutang Asuransi/Perusahaan   Rp800.000
Dr Piutang Pasien                Rp200.000
Cr Pendapatan Tindakan           Rp1.000.000
```
Item ditolak penjamin Rp100.000 dan dialihkan ke pasien: `Dr Piutang Pasien 100.000 | Cr Piutang Asuransi/Perusahaan 100.000` (dengan otorisasi).

### 6.12 Pembayaran digital, pembulatan, paket `[BARU v2]`

```text
QRIS Rp100.000, biaya 0,7% (ilustrasi):
  Dr Bank 99.300 | Dr Beban Biaya Transaksi 700 | Cr Piutang Pasien 100.000
Paket prabayar Rp1.200.000, pengakuan Rp300.000 per kunjungan:
  Dr Kas 1.200.000 | Cr Pendapatan Diterima di Muka 1.200.000
  Dr Pendapatan Diterima di Muka 300.000 | Cr Pendapatan Tindakan 300.000
Pembulatan tunai: selisih ke Selisih Kas dan Pembulatan (5900), sebagai baris tersendiri.
```
Transfer stok antar badan usaha: pengirim `Dr Piutang Antar Entitas | Cr Persediaan`; penerima `Dr Persediaan | Cr Utang Antar Entitas`.

### 6.13 Katalog event dan kunci idempotensi `[BARU v2]`

| Event | Sumber | Kunci idempotensi | Konsumen |
|---|---|---|---|
| `service.recognized` | service_transaction_item | `sti:{id}` | Billing, Accounting, Fee |
| `invoice.issued` | invoice | `inv:{id}` | Accounting, Claim |
| `payment.received` | payment | `pay:{id}` | Accounting, Fee, Claim |
| `inventory.moved` | inventory_movement | `inv_mv:{id}` | Accounting (HPP) |
| `capitation.recognized` | capitation_run | `cap:{id}` | Accounting |
| `fee.accrued` / `fee.paid` | fee_accrual / payout | `fee:{id}` | Accounting |
| `clinical.finalized` | encounter | `enc:{id}:{versi}` | Integration Hub (SATUSEHAT/PCare) |


---

# 7. Roadmap Implementasi `[REVISI v2]`

Urutan Tahap 2 hingga 4 fleksibel menurut profil klinik: klinik mitra JKN memprioritaskan Tahap 2; klinik yang pendapatan utamanya rawat inap dapat menukar Tahap 3 lebih awal.

## Tahap 0: Persiapan dan Kepatuhan (paralel dengan desain)

- Profil fasilitas, keputusan default (bagian 8.2), verifikasi butir `[V]` yang menghalangi.
- Registrasi SATUSEHAT dan pengumpulan kredensial; pengajuan bridging BPJS bila FKTP (lead time berjalan di belakang pengembangan).
- Rencana migrasi data dari sistem/kertas lama, RPO/RTO, hosting, perangkat (printer thermal, barcode).
- Penetapan konsultan pajak dan apoteker/penanggung jawab PDP.

Output: daftar keputusan tertandatangani, akses sandbox integrasi, rencana go-live.

## Tahap 1: Operational Core (rawat jalan)

Modul: Core, Facility, Patient, Front Office (antrean, jadwal), Praktisi dan guard SIP, Encounter, rekam medis, Poli dinamis, Lab, Farmasi dan stok dasar, Billing mandiri, Kasir (sesi, pembulatan), **SATUSEHAT dasar**, **outbox dan event akuntansi** (belum diposting).

Output: pasien mandiri dilayani end-to-end; data terkirim ke SATUSEHAT; event layanan dan pembayaran tertangkap.

## Tahap 2: Pembayar (JKN dan penjamin lain)

Modul: JKN (PCare, antrean Mobile JKN, kapitasi, klaim non-kapitasi), asuransi/perusahaan (LOG, kontrak), paket/membership, deposit, kode pajak.

Output: peserta JKN dan pasien asuransi dilayani; kapitasi dan klaim terlacak; piutang per pembayar.

## Tahap 3: IGD dan Rawat Inap

Modul: IGD, triase, observasi, rawat inap, bed management, MAR, discharge, billing rawat inap, kebijakan fasilitas (batas inap/tempat tidur).

## Tahap 4: Inventory dan Procurement

Modul: batch/ED, FEFO, stock opname, PBF dan pemasok, PO, penerimaan, konsinyasi, surat pesanan khusus, register narkotika/psikotropika dan SIPNAP, utang supplier.

## Tahap 5: Accounting dan Finance

Modul: COA, mapping berbasis aturan, Journal Engine (mulai memposting event yang telah terkumpul), kas dan bank, AR/AP, periode, pajak (PPN/PKP, rekap), laporan laba rugi, neraca, arus kas.

## Tahap 6: Business Management, Analytics, dan Ketahanan

Modul: payroll, jasa medis (payout), aset tetap, cost center, konsolidasi multi-cabang dan antar entitas, dashboard, PWA/offline-tolerant, uji pemulihan bencana berkala.

## Dependensi implementasi

```text
Tahap 0 (kepatuhan, keputusan, akses integrasi)
      |
      v
Core + Facility + Patient + Front Office + Praktisi (guard SIP)
      |
      v
Encounter + Clinical + Lab + Farmasi/Stok
      |
      +--------> Integration Hub (SATUSEHAT)
      |
      v
Service Transactions --> Billing --> Kasir
      |                    |
      |                    +--> Payer/Claim (JKN, asuransi)   [Tahap 2]
      v
Outbox / Event akuntansi (tertangkap sejak Tahap 1)
      |
      v
Accounting Engine (aktif Tahap 5) --> Laporan
      |
      +--> Procurement/AP, Inventory/HPP, Payroll/Fee, Fixed Assets
```

Jangan membangun laporan keuangan final sebelum sumber transaksi, mapping akun, dan mekanisme posting jurnal stabil. Event akuntansi boleh terkumpul lebih awal sehingga tidak ada data yang hilang saat posting diaktifkan.

## Kriteria selesai per tahap (tambahan)

- Uji kepatuhan: guard SIP, terminologi valid, idempotensi event, backup terverifikasi pulih.
- Paralel-run dengan proses lama sebelum cut-over.
- Pelatihan per peran dan prosedur downtime (3.12).

---

# 8. Risiko dan Keputusan yang Perlu Dikonfirmasi

## 8.1 Risiko utama

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Batas modul tidak jelas | Duplikasi data dan logic | Tetapkan pemilik domain |
| Poli terlalu hardcoded | Sulit dikembangkan | Gunakan konfigurasi service unit |
| Billing tersebar | Tagihan tidak konsisten | Gunakan Billing Engine terpusat |
| Jurnal dibuat manual oleh modul | Inkonsistensi akuntansi | Gunakan Accounting Engine |
| Stok hanya menyimpan saldo | Histori tidak dapat diaudit | Gunakan inventory movement |
| Encounter dan admission tercampur | Riwayat klinis tidak konsisten | Pisahkan domain visit, encounter, admission |
| Perubahan data klinis tanpa histori | Risiko integritas rekam medis | Versioning dan audit trail |
| Event diproses berulang | Tagihan/jurnal ganda | Idempotency dan transactional outbox |
| Hak akses terlalu luas | Risiko privasi dan penyalahgunaan | Role, permission, assignment, audit |
| Tutup periode tidak dikontrol | Laporan keuangan berubah | Accounting period lock |
| Integrasi SATUSEHAT/BPJS tertunda atau ditolak | Klinik tidak patuh, klaim tertunda | Mulai Tahap 0, sandbox, antrean retry, dasbor kegagalan |
| Praktisi tanpa SIP aktif bertugas | Risiko hukum | Guard legalitas dan pengingat |
| Salah klasifikasi pajak (jasa vs obat vs estetika) | Pajak kurang/lebih bayar | Kode pajak per item, tinjauan konsultan |
| Pendapatan kapitasi dicampur dengan per layanan | Pendapatan salah, analitik rusak | `coverage_type`, `capitation_runs` |
| Kebocoran data pasien | Sanksi, kerugian reputasi | Enkripsi kolom, break-glass, prosedur insiden 3x24 jam |
| Listrik/internet putus | Layanan terhenti | Prosedur downtime, input susulan, UPS, backup |
| Parameter regulasi berubah | Aturan tertanam kedaluwarsa | Konfigurasi ber-tanggal-berlaku, register regulasi |

## 8.2 Keputusan Default v2 dan Pertanyaan Terbuka `[REVISI v2]`

### Keputusan default (dapat diubah oleh pemilik klinik)

| Topik | Default v2 |
|---|---|
| Cakupan fasilitas | Struktur multi-cabang/badan usaha sejak awal; satu klinik hanyalah kasus khusus |
| Gudang, kasir, rekening | Per fasilitas |
| Akuntansi | Akrual penuh, perpetual inventory, double-entry |
| Pembayaran parsial dan deposit | Didukung |
| Rekam medis | SOAP umum + form tambahan per poli; addendum untuk koreksi |
| Tanda tangan elektronik | Ditunda; dirancang titik penerapannya |
| Jadwal dokter | Wajib (dibutuhkan antrean Mobile JKN dan guard SIP) |
| Platform | Web responsif (PWA bertahap) |
| Hosting | Wilayah Indonesia `[V]` |
| Integrasi | SATUSEHAT wajib; BPJS opsional per fasilitas; SIPNAP bila ada farmasi |

### Pertanyaan yang tetap perlu dikonfirmasi

#### Pertanyaan v1 (dipertahankan)

### Operasional

1. Apakah sistem hanya untuk satu klinik atau akan mendukung banyak cabang?
2. Apakah setiap cabang memiliki gudang sendiri?
3. Apakah setiap cabang mempunyai kasir dan rekening bank sendiri?
4. Apakah klinik menyediakan rawat inap, IGD, atau keduanya?
5. Apakah diperlukan layanan home care atau kunjungan luar fasilitas?

### Pelayanan klinis

1. Apakah rekam medis menggunakan satu format SOAP umum dengan form tambahan per Poli?
2. Apakah dokter dapat melakukan rujukan internal antar-Poli?
3. Apakah diperlukan tanda tangan elektronik?
4. Bagaimana mekanisme persetujuan dan addendum catatan klinis?
5. Apakah diperlukan pengelolaan jadwal dokter?

### Pembiayaan

1. Apakah seluruh pasien membayar mandiri atau ada penjamin?
2. Apakah akan mendukung BPJS/JKN?
3. Apakah pembayaran dapat dilakukan secara parsial?
4. Apakah pasien dapat memiliki deposit?
5. Apakah ada paket layanan, membership, atau kontrak perusahaan?

### Akuntansi

1. Apakah klinik menggunakan basis akrual penuh?
2. Apakah laporan keuangan dibuat per cabang atau konsolidasi?
3. Apakah persediaan menggunakan perpetual inventory?
4. Bagaimana pengakuan pendapatan untuk penjamin yang pembayarannya tertunda?
5. Bagaimana kebijakan pengakuan pendapatan dan HPP untuk retur, pembatalan, serta koreksi?

### Teknologi

1. Apakah aplikasi hanya web atau juga membutuhkan aplikasi desktop/mobile?
2. Apakah sistem membutuhkan mode offline?
3. Apakah integrasi eksternal mencakup BPJS, Satu Sehat, laboratorium eksternal, dan payment gateway?
4. Apakah sistem akan digunakan oleh satu organisasi atau beberapa badan usaha?

### Kepatuhan dan konteks Indonesia `[BARU v2]`
1. Apakah klinik mitra BPJS (FKTP)? Berapa peserta terdaftar? Sudah punya bridging PCare/antrean?
2. Status PKP badan usaha? Ada penjualan obat bebas, estetika, atau layanan lain dengan perlakuan pajak berbeda?
3. Status dokter (pegawai, mitra, tenaga ahli) dan skema bagi hasil?
4. Layanan MCU/perusahaan dan TPA asuransi mana saja?
5. Siapa apoteker penanggung jawab dan penanggung jawab pelindungan data pribadi?
6. Kondisi internet/listrik di lokasi; perlu mode offline?
7. Ada sistem lama yang perlu dimigrasi?

---

# 9. Rekomendasi Prioritas Desain

Sebelum mulai membuat migration Laravel, tetapkan terlebih dahulu domain dan kontrak integrasi berikut:

1. **Patient dan Visit:** identitas pasien dan kunjungan administratif.
2. **Encounter:** pusat episode pelayanan klinis.
3. **Service Unit:** unit pelayanan yang dapat dikonfigurasi.
4. **Clinical Workflow:** mekanisme pelayanan yang dapat disesuaikan per unit.
5. **Service Transaction:** sumber biaya dari seluruh unit.
6. **Billing:** pembentukan tagihan dan piutang.
7. **Payment:** penerimaan dan alokasi pembayaran.
8. **Inventory Movement:** sumber kebenaran histori stok.
9. **Accounting Engine:** pembentukan jurnal dan buku besar.
10. **Audit Log:** histori aktivitas dan perubahan penting.
11. **Practitioner dan Legalitas:** STR/SIP, jadwal, jasa medis. `[BARU v2]`
12. **Payer dan Coverage:** pembayar, kapitasi, klaim, kontrak. `[BARU v2]`
13. **Integration Contracts:** SATUSEHAT, BPJS, SIPNAP, terminologi, outbox. `[BARU v2]`

Ketiga belas bagian tersebut merupakan fondasi integrasi. Jika kontraknya stabil, pengembangan modul tambahan akan jauh lebih mudah.

## Rekomendasi implementasi Laravel

Gunakan modular monolith dengan pemisahan namespace, misalnya:

```text
app/
  Modules/
    Core/
    Patient/
    FrontOffice/
    Clinical/
    Emergency/
    Inpatient/
    Laboratory/
    Pharmacy/
    Inventory/
    Billing/
    Cashier/
    Accounting/
    Procurement/
    Supplier/
    Asset/
    Payroll/
    Reporting/
    Facility/            (organisasi, badan usaha, fasilitas, kebijakan)
    Practitioner/        (praktisi, STR/SIP, jadwal)
    Remuneration/        (jasa medis)
    Payer/               (pembayar, kontrak, kapitasi, klaim)
    Tax/
    Integration/         (SATUSEHAT, BPJS, SIPNAP, pembayaran, terminologi)
    Privacy/             (consent, hak subjek data, insiden)
```

Setiap modul sebaiknya mempunyai struktur:

```text
ModuleName/
  Domain/
    Models/
    Events/
    Rules/
    Services/
  Application/
    Actions/
    DTOs/
    UseCases/
  Infrastructure/
    Repositories/
    Listeners/
  Presentation/
    Http/
      Controllers/
      Requests/
      Resources/
```

Struktur tersebut adalah contoh batas organisasi kode, bukan kewajiban untuk menerapkan DDD secara penuh. Hindari abstraksi berlebihan pada tahap awal.

Gunakan database transaction untuk operasi lintas tabel yang harus atomik, event untuk komunikasi antar-domain, queue untuk pekerjaan asinkron, serta outbox untuk event penting yang tidak boleh hilang.

`[BARU v2]` Tegakkan batas modul secara otomatis (mis. uji arsitektur atau alat analisis dependensi di CI) agar aturan "modul tidak mengakses tabel domain lain" tidak bergantung pada disiplin manual. Hindari abstraksi berlebihan pada tahap awal.

---

# 10. Kesimpulan Arsitektur

Clinic ERP sebaiknya dibangun sebagai satu platform terintegrasi dengan pemisahan tanggung jawab yang tegas:

- Front Office mengelola pasien dan kunjungan.
- Clinical Services mengelola pelayanan dan dokumentasi medis.
- Supporting Services mengelola pemeriksaan penunjang, obat, dan persediaan.
- Billing menghitung biaya pelayanan.
- Kasir mengelola uang yang diterima atau dibayarkan.
- Accounting mencatat transaksi keuangan dalam jurnal.
- Business Management mengelola aktivitas bisnis pendukung.
- Core Platform menyediakan fondasi identitas, konfigurasi, akses, workflow, dan audit.
- `[BARU v2]` Integration & Compliance Hub mengisolasi SATUSEHAT, BPJS, SIPNAP, pembayaran digital, dan kewajiban privasi.
- `[BARU v2]` Practitioner & Remuneration memastikan legalitas praktisi dan remunerasi dokter.
- `[BARU v2]` Payer/Claim mengelola pembayar jamak, kapitasi, dan klaim di luar Billing murni.

**Keputusan arsitektur paling penting:** jangan menjadikan Poli, IGD, Laboratorium, Farmasi, Kasir, dan Akuntansi sebagai modul yang saling berdiri sendiri tanpa kontrak integrasi. Masing-masing merupakan domain dengan tanggung jawab berbeda, tetapi harus bekerja dalam satu siklus data dan transaksi yang konsisten.

Blueprint ini menjadi dasar untuk menyusun ERD final, migration Laravel, API contract, workflow diagram, dan backlog implementasi secara bertahap.


---

# Lampiran A. Register Regulasi `[BARU v2]`

Status verifikasi: **T** = terkonfirmasi sumber yang dibaca; **V** = perlu verifikasi primer. Tanggal pemeriksaan: 17 November 2026.

| Regulasi/ketentuan | Topik | Status |
|---|---|---|
| UU 17/2023 tentang Kesehatan; PP 28/2024 | Kerangka induk, STR/SIP, SIKN | T / pasal V |
| Permenkes 24/2022 tentang Rekam Medis | RME wajib, integrasi SATUSEHAT, backup, retensi | T / retensi V |
| Permenkes 9/2014 tentang Klinik | Jenis, rawat inap, bangunan, ketenagaan | V (status berlaku) |
| PP 28/2024, Permenkes 11/2025 | Perizinan berusaha berbasis risiko sektor kesehatan | V |
| SE Menkes HK.02.01/MENKES/6/2024 | Tata cara SIP pasca UU 17/2023 | T |
| Permenkes 3/2015 | Narkotika, psikotropika, prekursor; SIPNAP | T |
| Permenkes 34/2021 | Standar pelayanan kefarmasian klinik | V |
| UU HPP, PP 49/2022 | PPN jasa medis dibebaskan, obat BKP, PKP | T / tarif V |
| UU 27/2022, PP 33/2026 | Pelindungan data pribadi | V |
| Ketentuan BPJS Kesehatan (PCare, antrean, kapitasi/non-kapitasi) | JKN FKTP | V |
| Dokumentasi API SATUSEHAT | FHIR, terminologi, autentikasi | V |

# Lampiran B. Glosarium

| Istilah | Arti |
|---|---|
| FKTP / FKRTL | Fasilitas kesehatan tingkat pertama / rujukan tingkat lanjut |
| JKN / BPJS | Jaminan Kesehatan Nasional / badan penyelenggara |
| PCare | Aplikasi BPJS untuk pelayanan di FKTP |
| Mobile JKN | Aplikasi peserta; mencakup antrean daring |
| Kapitasi / non-kapitasi | Pembayaran per peserta terdaftar / per pelayanan |
| PRB, Prolanis | Program rujuk balik, pengelolaan penyakit kronis |
| SATUSEHAT | Platform data kesehatan Kemenkes (FHIR) |
| IHS Number | Identitas pasien di SATUSEHAT |
| KFA | Kamus Farmasi dan Alat Kesehatan |
| KPTL | Klasifikasi kode tindakan/prosedur untuk SATUSEHAT `[V]` |
| STR / SIP / SIPA | Surat tanda registrasi / izin praktik / izin praktik apoteker |
| SIPNAP | Sistem pelaporan narkotika dan psikotropika |
| PBF | Pedagang besar farmasi |
| LOG / TPA | Letter of guarantee / third party administrator asuransi |
| MCU | Medical check-up |
| PKP | Pengusaha kena pajak |
| BKP | Barang kena pajak |
| MDR | Biaya transaksi pembayaran digital |
