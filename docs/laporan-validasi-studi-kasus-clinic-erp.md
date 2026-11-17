# Laporan Validasi dan Studi Kasus: Blueprint Clinic ERP (v1 → v2)

**Tanggal:** 17 November 2026
**Objek:** `blueprint-clinic-erp.md` (v1, ±1.660 baris)
**Konteks:** klinik pratama/utama dan jaringan klinik di Indonesia
**Pendamping:** `blueprint-clinic-erp-v2.md` (hasil perbaikan)

> Catatan batasan: pemeriksaan regulasi memakai pencarian web (Kemenkes, DDTC, Hukumonline, publikasi akademik, dokumentasi vendor/SDK). Teks resmi (JDIH/peraturan.go.id) tidak seluruhnya dibuka. Butir bertanda **[V]** wajib diverifikasi ke teks primer dan ahli hukum/pajak sebelum dikunci sebagai aturan sistem. Dokumen ini bukan nasihat hukum, pajak, atau akuntansi. Tiga studi kasus adalah **skenario ilustratif komposit**, bukan entitas nyata; angka rupiah hanya untuk memperagakan logika jurnal.

---

## 1. Ringkasan eksekutif

**Kesimpulan:** fondasi arsitektur v1 kuat, tetapi v1 masih blueprint "klinik generik berbasis tarif per layanan", belum blueprint "klinik Indonesia".

**Yang sudah benar dan dipertahankan**
- Pemisahan Patient / Visit / Encounter / Admission.
- Pemisahan Service Module → Billing → Kasir → Accounting; larangan modul klinis membuat jurnal.
- Inventory movement append-only; jurnal posted tidak bisa diedit; reversal/adjustment.
- Outbox + idempotency, audit trail, versioning catatan klinis, penugasan unit terpisah dari role.
- Prinsip "jangan kunci tarif/pajak di kode".

**Tiga kelompok kekurangan utama**
1. **Ekosistem wajib Indonesia belum ada di desain:** SATUSEHAT, BPJS FKTP (PCare, antrean Mobile JKN, kapitasi, klaim), SIPNAP, STR/SIP. Di v1 semua ini hanya muncul sebagai pertanyaan terbuka (8.2).
2. **Model pembayar dan pajak terlalu sederhana:** tidak bisa menjalankan kapitasi, klaim non-kapitasi, surat jaminan asuransi, PPN obat vs jasa medis dibebaskan, deposit, jasa medis dokter.
3. **Cacat integritas skema:** entitas dirujuk tapi tidak didefinisikan (`cashier_sessions`, `outbox_events`, `medical_records`), tautan yang hilang (admission → visit), kepemilikan ganda, `drug_batches` vs `inventory_batches`.

**Hasil uji 35 skenario (3 studi kasus):**

| Hasil | v1 | v2 |
|---|---|---|
| Lulus / Tercakup tanpa syarat | 2 | 24 |
| Sebagian / Tercakup bersyarat (perlu persetujuan eksternal atau verifikasi [V]) | 17 | 10 |
| Gagal / Sebagian (di luar desain murni) | 16 | 1 |

"Tercakup" berarti **desain** v2 memuatnya, belum berarti telah dibangun atau diuji sebagai kode.

---

## 2. Metode

1. **Konsistensi internal:** membaca seluruh blueprint, mencocokkan daftar entitas (bab 2), skema (bab 4), aturan (bab 5), jurnal (bab 6), dan roadmap (bab 7).
2. **Kesesuaian regulasi Indonesia:** memetakan kewajiban ke desain (bagian 4 laporan ini).
3. **Uji skenario:** tiga profil klinik; tiap skenario dijalankan terhadap v1 dan v2 (bagian 5).

---

## 3. Temuan validasi internal dan regulasi

Tingkat: **Kritis** (menghalangi operasi/legal), **Tinggi**, **Sedang**, **Rendah**.

### 3.1 Integritas skema dan arsitektur

| ID | Tingkat | Temuan | Perbaikan di v2 |
|---|---|---|---|
| S-01 | Tinggi | `payments.cashier_session_id` merujuk tabel yang tidak ada di daftar entitas | Tambah `cashier_sessions`, `cash_drawer_counts` (4.2 G2) |
| S-02 | Tinggi | `inpatient_admissions` tanpa `patient_visit_id`; `service_transactions` tanpa `admission_id`. Tagihan IGD→rawat inap tidak punya jangkar tunggal | Tambah `billing_accounts`; tautan visit/admission pada semua transaksi layanan |
| S-03 | Sedang | `drug_batches` (Farmasi) duplikat `inventory_batches` (Gudang) | Satukan ke `inventory_batches`; farmasi hanya merujuk |
| S-04 | Sedang | Kepemilikan ganda: `supplier_invoices*` di Accounting dan Business Mgmt; `service_units` di Core dan Clinical | Tetapkan pemilik tabel; Accounting hanya menerima event |
| S-05 | Sedang | `medical_records` ada di daftar entitas tapi tak pernah didefinisikan | Dihapus; rekam medis = agregasi encounter + dokumen (dinyatakan eksplisit) |
| S-06 | Tinggi | Outbox/idempotency dijelaskan (6.6) tapi tabelnya tidak ada | Tambah `outbox_events`, `processed_events` |
| S-07 | Tinggi | `payments.patient_id` dan `invoice_items.guarantor_id`: pembayar bukan pasien (BPJS, asuransi, perusahaan) tak bisa menjadi pembayar | Model `payers`; invoice per pembayar; `payments.payer_id` |
| S-08 | Sedang | `patient_visits.guarantor_id` tunggal; tak mendukung coverage berlapis | `patient_coverages` + alokasi pembayar per item |
| S-09 | Sedang | `account_mappings` satu pasangan debit/kredit; tidak cukup untuk jurnal multi-baris (pendapatan + PPN + diskon + HPP) dan tanpa tanggal berlaku | `account_mapping_rules` + baris, ber-tanggal-berlaku |
| S-10 | Sedang | Tarif tanpa tanggal berlaku eksplisit dan tanpa kode pajak | `effective_from/to` dan `tax_code_id` pada katalog/tarif |
| S-11 | Rendah | `encounter_diagnoses` menyimpan kode+nama sebagai teks; tak ada tabel terminologi | `terminology_codes` (ICD-10, KPTL, KFA, LOINC) + snapshot |
| S-12 | Sedang | `facility_id` hanya "jika perlu"; menambah belakangan sangat mahal | Wajib sejak awal (`organization_id`, `facility_id`) |
| S-13 | Sedang | Tidak ada entitas praktisi; dokter mitra tanpa akun, STR/SIP, jadwal | Domain Practitioner & Remuneration |

### 3.2 Akuntansi dan pajak

| ID | Tingkat | Temuan | Perbaikan |
|---|---|---|---|
| A-01 | Tinggi | Contoh jurnal tanpa pajak. Di Indonesia jasa medis PPN dibebaskan sedangkan obat tetap BKP; dua perlakuan dalam satu invoice | `tax_codes` per item katalog; contoh jurnal 6.9 |
| A-02 | Tinggi | Tidak ada pengakuan pendapatan kapitasi (bukan per layanan) | `capitation_runs`; jurnal 6.7 |
| A-03 | Sedang | Tidak ada deposit/uang muka pasien (liabilitas) | `patient_deposits`; jurnal 6.10 |
| A-04 | Sedang | COA contoh tak punya Piutang BPJS/asuransi, Pendapatan kapitasi, Utang jasa medis, PPN masukan/keluaran, Utang PPh 21, Uang muka pasien, Pendapatan diterima di muka, Beban biaya transaksi | COA diperluas (2.6) |
| A-05 | Sedang | Contoh pembelian (6.4) tak membedakan PKP/non-PKP. Bagi non-PKP, PPN masukan umumnya menjadi bagian harga perolehan [V] | Jurnal 6.9 dua varian |
| A-06 | Sedang | Jasa medis dokter tidak ada; praktik bagi hasil per tindakan sangat umum | Modul 2.8; jurnal 6.8 |
| A-07 | Rendah | Tidak ada pembulatan tunai, biaya transaksi QRIS/EDC | Baris penyesuaian, `payment_methods.fee_rule` |

### 3.3 Regulasi dan interoperabilitas Indonesia

| ID | Tingkat | Temuan | Perbaikan |
|---|---|---|---|
| R-01 | Kritis | Tidak ada desain SATUSEHAT, padahal RME fasyankes wajib terintegrasi | Integration Hub 2.9 A |
| R-02 | Kritis (klinik JKN) | Tidak ada desain PCare, antrean Mobile JKN, kapitasi, klaim | 2.9 B, 2.5, 3.7 |
| R-03 | Tinggi | Tidak ada guard STR/SIP; mempekerjakan nakes tanpa SIP berisiko pidana [V pasal] | `practitioner_licenses` + guard |
| R-04 | Tinggi | UU PDP: consent, hak subjek data, notifikasi insiden 3x24 jam, DPO belum didesain | `consent_records`, `data_subject_requests`, `security_incidents` |
| R-05 | Sedang | Narkotika/psikotropika: surat pesanan khusus, register, SIPNAP bulanan | Alur 3.10; adapter SIPNAP |
| R-06 | Sedang | Retensi RME 25 tahun [V] dan kewajiban backup vs desain tanpa kebijakan arsip | `data_retention_policies`, DR |
| R-07 | Sedang | Batas klinik rawat inap (kapasitas, lama inap) [V], perizinan berbasis risiko | `facility_policies` ber-tanggal-berlaku |
| R-08 | Sedang | Identitas: NIK, bayi, WNA, pasien tak dikenal di IGD | Aturan 5.7 |
| R-09 | Sedang | Roadmap: kepatuhan dan BPJS tidak muncul di tahap mana pun | Tahap 0 dan Tahap 2 baru |
| N-01 | Sedang | Tidak ada strategi downtime/offline, RPO/RTO, listrik/internet tidak stabil | Alur 3.12, NFR, PWA di Tahap 6 |
| N-02 | Rendah | Tidak ada rencana migrasi dari kertas/Excel/SIM lama | Tahap 0 dan paralel-run |
| N-03 | Rendah | Perangkat (printer thermal, barcode, label spesimen) dan WhatsApp tidak disebut | Dicantumkan di Integration Hub dan roadmap |

---

## 4. Peta regulasi yang dipakai

| Topik | Ketentuan yang ditemukan | Status |
|---|---|---|
| RME wajib | Permenkes 24/2022 Pasal 3: setiap fasyankes termasuk klinik wajib menyelenggarakan RME; transisi paling lambat 31 Des 2023; wajib terintegrasi SATUSEHAT; ada sanksi administratif (teguran hingga rekomendasi penyesuaian status akreditasi) | Terkonfirmasi sumber Kemenkes/pasal.id |
| Retensi RME | Paling singkat 25 tahun sejak kunjungan terakhir (Pasal 39 ayat 1 menurut ulasan sekunder) | **[V]** satu sumber sekunder |
| Backup RME | Fasyankes wajib punya sistem cadangan data | Sumber akademik, **[V]** pasal |
| Klinik | Permenkes 9/2014: pratama (dokter/dokter gigi) dan utama (spesialis); klinik pratama rawat inap harus berbentuk badan usaha, 5–10 tempat tidur, lama inap maksimal 5 hari. Perizinan kini bergeser ke PP 28/2024 dan Permenkes 11/2025 (OSS berbasis risiko); sebagian substansi 9/2014 disebut bertentangan | **[V]** status berlaku dan parameter |
| STR/SIP | STR berlaku seumur hidup (UU 17/2023 Pasal 260 ayat 4); SIP diterbitkan pemda kab/kota (Pasal 263); SE Menkes HK.02.01/MENKES/6/2024 mengenal SIP ke-1 sampai ke-3; rekomendasi organisasi profesi dihapus; mempekerjakan nakes tanpa SIP diancam pidana (Pasal 442) | Terkonfirmasi sumber Kemenkes/Hukumonline |
| JKN FKTP | Klinik pratama mitra BPJS dibayar kapitasi dan non-kapitasi (per pelayanan, diklaim berkala); terhubung PCare, Mobile JKN antrean, i-Care. Bridging harus diajukan klinik sendiri ke BPJS (consumer ID, UAT, monitoring); antrean online baru bisa setelah bridging PCare selesai | Sumber akademik dan dokumentasi vendor, **[V]** ke BPJS |
| Narkotika/psikotropika | Permenkes 3/2015; surat pesanan khusus; penyerahan ke pasien hanya dengan resep; pelaporan bulanan lewat SIPNAP, umumnya paling lambat tanggal 10 bulan berikutnya | Beberapa sumber konsisten |
| Apoteker | Klinik dengan rawat inap wajib punya apoteker penanggung jawab pelayanan kefarmasian (Permenkes 34/2021) | Sumber sekunder, **[V]** |
| PPN | Jasa pelayanan kesehatan medis: PPN dibebaskan (PP 49/2022 Pasal 11, termasuk jasa fasilitas klinik); penyerahan obat tetap BKP; pengusaha dengan peredaran usaha di atas Rp4,8 miliar wajib PKP. Jasa kecantikan pernah dijelaskan DJP sebagai kena PPN. Tarif/DPP efektif bisa berubah | Terkonfirmasi DDTC; tarif **[V]** |
| UU PDP | Data kesehatan = data pribadi spesifik; notifikasi kegagalan pelindungan data ke subjek dan lembaga paling lambat 3x24 jam (Pasal 46); PP 33/2026 sebagai peraturan pelaksana; pembentukan Lembaga PDP masih berproses per pertengahan 2026 | **[V]** PP 33/2026 dan status lembaga |
| SATUSEHAT | FHIR R4, OAuth2 client credentials; pasien dicari via NIK untuk memperoleh IHS Number; resource: Organization, Location, Practitioner, Patient, Encounter, Condition (ICD-10), Observation, Procedure (KPTL), MedicationRequest/Dispense (KFA); respons duplikat harus ditangani | Dokumentasi SDK komunitas, **[V]** ke portal resmi |
| Gawat darurat | UU 17/2023 melarang fasyankes menolak pasien gawat darurat atau meminta uang muka lebih dahulu | **[V]** pasal |
| Residensi data | Tidak ditemukan kepastian apakah klinik wajib menyimpan RME di dalam negeri; PP 28/2024 mengarah ke integrasi data ke SIKN | **[V]**; default v2: hosting wilayah Indonesia |

---

## 5. Studi kasus

### Kasus A: Klinik Pratama Rawat Inap, mitra BPJS (kota kabupaten, Pulau Jawa)

**Profil (fiktif):** PT pemilik klinik; poli umum, gigi, KIA; IGD/pelayanan 24 jam; rawat inap 8 tempat tidur; apotek dan lab sederhana; 6.000 peserta JKN terdaftar; dokter sebagian pegawai, sebagian mitra dengan bagi hasil; praktisi punya SIP di lebih dari satu tempat.

| # | Skenario | v1 | v2 |
|---|---|---|---|
| A0 | Pasien umum tunai: daftar → SOAP → resep → bayar → jurnal | Lulus | Tercakup |
| A1 | Peserta mengambil antrean via Mobile JKN lalu check-in | Gagal | Bersyarat: perlu bridging dan UAT dengan BPJS |
| A2 | Verifikasi kepesertaan dan status FKTP terdaftar | Sebagian | Bersyarat: BPJS |
| A3 | Kirim kunjungan, diagnosis, tindakan, obat ke PCare | Gagal | Bersyarat: BPJS |
| A4 | Pendapatan kapitasi bulanan tanpa invoice per layanan | Gagal | Tercakup: `capitation_runs` |
| A5 | Klaim non-kapitasi bulanan (mis. persalinan, ambulans, rawat inap tingkat pertama) | Sebagian | Bersyarat: format klaim [V] |
| A6 | Pasien IGD malam tanpa KTP/pingsan | Sebagian | Tercakup: identitas sementara + merge |
| A7 | Dokter dengan SIP kedaluwarsa atau bukan untuk lokasi ini dijadwalkan | Gagal | Tercakup: guard SIP |
| A8 | Jasa medis dokter mitra per tindakan | Gagal | Bersyarat: klasifikasi pajak [V] |
| A9 | Resep psikotropika: lemari khusus, register, SIPNAP | Sebagian | Tercakup |
| A10 | Kirim data ke SATUSEHAT | Gagal | Bersyarat: registrasi dan UAT |
| A11 | Pasien dirawat 6 hari di klinik dengan batas 5 hari | Gagal | Bersyarat: parameter [V] |
| A12 | Listrik/internet putus saat jam sibuk | Gagal | Sebagian: prosedur downtime dan input susulan; PWA offline penuh ditunda |
| A13 | Obat racikan dan BHP yang terpakai pada tindakan | Sebagian | Tercakup |
| A14 | Shift kasir, tutup kas, pembulatan tunai | Sebagian | Tercakup |

**Contoh jurnal (angka ilustrasi)**

Kapitasi bulan berjalan, 6.000 peserta × Rp10.000:
```text
Dr Piutang BPJS Kesehatan        Rp60.000.000
Cr Pendapatan Kapitasi JKN       Rp60.000.000
(saat diterima)
Dr Bank                          Rp60.000.000
Cr Piutang BPJS Kesehatan        Rp60.000.000
```
Pelayanan peserta dalam kapitasi: tagihan pasien Rp0; obat dan BHP yang keluar dicatat ke `Beban Obat & BHP Pelayanan Kapitasi` (Dr) dan Persediaan (Cr), sehingga biaya per kunjungan tetap bisa dianalisis.

Jasa medis dokter mitra: tindakan umum Rp200.000, bagi hasil 60%:
```text
Dr Beban Jasa Medis              Rp120.000
Cr Utang Jasa Medis              Rp120.000
(saat dibayar; potongan PPh 21 sesuai status, nilai X ditentukan konsultan pajak)
Dr Utang Jasa Medis              Rp120.000
Cr Utang PPh 21                  X
Cr Kas/Bank                      Rp120.000 − X
```

### Kasus B: Klinik Utama non-JKN (asuransi swasta, MCU perusahaan, paket)

**Profil (fiktif):** klinik spesialis dan layanan MCU; pasien mandiri, asuransi swasta via TPA dengan surat jaminan (LOG), kontrak perusahaan; paket prabayar dan membership; PKP karena omzet tinggi; pembayaran tunai, transfer, QRIS, EDC.

| # | Skenario | v1 | v2 |
|---|---|---|---|
| B1 | Pasien cashless: LOG, plafon, co-pay | Sebagian | Tercakup |
| B2 | Item ditolak asuransi setelah invoice terbit, dialihkan ke pasien | Sebagian | Tercakup |
| B3 | Kontrak MCU 200 karyawan, invoice bulanan, hasil rinci tidak boleh ke HRD | Gagal | Tercakup: kontrak, paket, consent dan ringkasan fit-to-work |
| B4 | Paket prabayar/membership (pendapatan diterima di muka) | Gagal | Tercakup |
| B5 | Pajak berbeda per item (jasa, obat, layanan estetika) | Gagal | Bersyarat: klasifikasi oleh konsultan [V] |
| B6 | QRIS/EDC/transfer, biaya transaksi, pembulatan | Sebagian | Tercakup |
| B7 | Dokter spesialis praktik di 3 tempat; jadwal dan kuota | Gagal | Tercakup |
| B8 | Penjualan obat dengan PPN dan faktur pajak | Gagal | Bersyarat: status PKP, tarif [V] |
| B9 | Batal tindakan setelah bayar: refund, credit note, koreksi pajak | Sebagian | Tercakup |
| B10 | Pasien/pihak ketiga meminta akses rekam medis; SLA hak subjek data | Sebagian | Bersyarat: PP 33/2026 [V] |

**Contoh jurnal (angka ilustrasi)**

Tagihan Rp1.000.000, LOG menanggung 80%, jasa medis non-PPN:
```text
Dr Piutang Asuransi/Perusahaan   Rp800.000
Dr Piutang Pasien                Rp200.000
Cr Pendapatan Tindakan           Rp1.000.000
```
Obat Rp50.000 (PKP; tarif 11% hanya ilustrasi, tarif/DPP efektif dikonfigurasi dan diverifikasi):
```text
Dr Piutang Pasien                Rp55.500
Cr Pendapatan Farmasi            Rp50.000
Cr PPN Keluaran                  Rp5.500
```
Pembelian obat kredit Rp1.000.000 + PPN Rp110.000:
```text
PKP:      Dr Persediaan Obat Rp1.000.000 ; Dr PPN Masukan Rp110.000 ; Cr Utang Supplier Rp1.110.000
Non-PKP:  Dr Persediaan Obat Rp1.110.000 ; Cr Utang Supplier Rp1.110.000   [V]
```
QRIS Rp100.000, biaya transaksi 0,7% (ilustrasi):
```text
Dr Bank                          Rp99.300
Dr Beban Biaya Transaksi         Rp700
Cr Piutang Pasien                Rp100.000
```
Paket prabayar Rp1.200.000, lalu pengakuan Rp300.000 per kunjungan:
```text
Dr Kas/Bank                      Rp1.200.000
Cr Pendapatan Diterima di Muka   Rp1.200.000
Dr Pendapatan Diterima di Muka   Rp300.000
Cr Pendapatan Tindakan           Rp300.000
```

### Kasus C: Jaringan 3 klinik, gudang obat pusat

**Profil (fiktif):** satu holding, dua badan usaha berbeda; satu cabang di zona waktu WITA; gudang pusat memasok cabang; dokter praktik lintas cabang; tarif berbeda per cabang.

| # | Skenario | v1 | v2 |
|---|---|---|---|
| C1 | Satu identitas pasien lintas cabang | Sebagian | Tercakup |
| C2 | Transfer stok pusat→cabang dengan batch/ED dan biaya | Sebagian | Tercakup |
| C3 | Dua badan usaha: piutang/utang antar entitas | Gagal | Tercakup: `legal_entities` + akun antar entitas |
| C4 | Satu ID organisasi SATUSEHAT per fasyankes/cabang | Gagal | Tercakup |
| C5 | Tarif beda per cabang dan tanggal berlaku | Sebagian | Tercakup |
| C6 | Laporan per cabang dan konsolidasi | Sebagian | Tercakup |
| C7 | Dokter lintas cabang, SIP per lokasi | Gagal | Tercakup |
| C8 | Zona waktu WIB/WITA | Lulus | Tercakup (dipertahankan, ditegaskan) |
| C9 | Kasir dan rekening bank per cabang | Sebagian | Tercakup |
| C10 | Akses data lintas cabang dan akses darurat (break-glass) | Sebagian | Tercakup |

Transfer stok antar badan usaha:
```text
Gudang pusat (PT A): Dr Piutang Antar Entitas ; Cr Persediaan Obat
Cabang (PT B):       Dr Persediaan Obat ; Cr Utang Antar Entitas
```

---

## 6. Ringkasan skor per area

| Area | v1 | v2 (desain) |
|---|---|---|
| Alur klinis inti (visit/encounter/admission, SOAP, lab, farmasi) | Baik | Baik, ditambah terminologi dan consent |
| Billing dan pembayar | Cukup untuk bayar mandiri | Mendukung JKN, asuransi, perusahaan, paket, deposit |
| Akuntansi | Struktur benar, contoh terlalu sederhana | COA, mapping multi-baris, pajak |
| Integrasi (SATUSEHAT, BPJS, SIPNAP, pembayaran) | Tidak ada | Hub tersendiri |
| Kepatuhan praktisi dan privasi | Tidak ada | Domain tersendiri |
| Multi-cabang/badan usaha | Opsional, tidak matang | Dasar sejak awal |
| Operasional (downtime, migrasi) | Tidak ada | Prosedur dan tahap roadmap |

---

## 7. Keputusan yang tidak bisa ditentukan tanpa pemilik klinik

1. Apakah klinik mitra JKN (FKTP)? Menentukan Tahap 2.
2. Bentuk badan usaha dan status PKP.
3. Status dokter: pegawai tetap, mitra, atau campuran; skema bagi hasil.
4. Ada rawat inap/IGD 24 jam? Berapa tempat tidur?
5. Satu cabang atau lebih; satu atau beberapa badan usaha.
6. Layanan MCU/perusahaan dan asuransi swasta (TPA mana).
7. Hosting: cloud wilayah Indonesia atau server lokal; kondisi internet/listrik.
8. Sistem lama yang perlu dimigrasi.
9. Siapa penanggung jawab PDP/keamanan informasi dan siapa apoteker penanggung jawab.
10. Vendor pembayaran digital yang dipakai.

---

## 8. Sumber utama

- Permenkes 24/2022 Rekam Medis: pasal.id/peraturan/permen/permenkes-no-24-tahun-2022; Kemenkes (kemkes.go.id), berita registrasi RME; ulasan retensi 25 tahun: medminutes.io
- Permenkes 9/2014 Klinik: hukumonline.com/klinik; farmalkes.kemkes.go.id; pembaruan perizinan: legawa.com (update regulasi klinik 2026)
- STR/SIP: kemkes.go.id (tata cara perizinan nakes UU 17/2023); SE Menkes HK.02.01/MENKES/6/2024 (jdih.kemkes.go.id); hukumonline.com
- PPN jasa medis dan obat: news.ddtc.co.id (PP 49/2022, Kring Pajak)
- UU PDP dan PP 33/2026: jawapos.com; meridianhukum.com; pasal.id
- BPJS/PCare/Mobile JKN: bantuan.klinikpintar.id (alur bridging); jurnal akademik FKTP
- SATUSEHAT: packagist.org (SDK komunitas), github.com/ivanwilliammd/satusehat-integration (aturan validasi)
- SIPNAP dan Permenkes 3/2015: halodoc.com, repositori akademik, SOP klinik
