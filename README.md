# Cookie Brother

Ekstensi Chromium Manifest V3 untuk melihat, mengedit, mengimpor, dan mengekspor cookies secara lokal. Dibuat dengan HTML, CSS, dan JavaScript vanilla tanpa framework atau proses build.

## Instalasi development

1. Buka `brave://extensions` atau `chrome://extensions`.
2. Aktifkan **Developer mode**.
3. Pilih **Load unpacked** dan arahkan ke folder proyek ini.
4. Buka situs web yang cookies-nya ingin dikelola, lalu klik ikon Cookie Brother.

Editor penuh dapat dibuka dari tombol **Editor** di popup. Klik kanan ikon extension untuk membuka editor dengan domain tab aktif terisi.

## Fitur

- Melihat cookies dari tab aktif dan frame yang dapat diakses, termasuk flag HttpOnly, Secure, SameSite, cookie store, dan partition key.
- Melihat cookies satu domain atau seluruh domain, pencarian, filter, pengurutan, pemilihan banyak, tambah/edit/hapus, dan ekspor.
- Import dengan deteksi otomatis dan pratinjau: Cookie Brother JSON, JSON array, Playwright/Puppeteer storageState, Netscape cookies.txt, Cookie header, Set-Cookie, HAR, dan objek JSON bergaya Chrome SQLite.
- Ekspor Cookie Brother JSON, Netscape cookies.txt, Cookie header, atau JSON polos.
- Salin hasil ekspor ke clipboard atau unduh sebagai file. Impor dapat dilakukan dengan menempel teks atau memilih file langsung dari popup/editor tanpa membuka tab baru.
- Tema Light, Dark, dan System; pengaturan disimpan di `chrome.storage.local`.
- Auto-refresh tab setelah setidaknya satu cookie berhasil diimpor.

Seluruh pemrosesan dilakukan di extension lokal. Tidak ada server, telemetri, analytics, atau permintaan jaringan yang dibuat oleh kode extension.

## Permission

| Permission | Alasan |
|---|---|
| `cookies` | Membaca, membuat, dan menghapus cookies. |
| Host permission `<all_urls>` | `chrome.cookies` memerlukan izin host untuk mengelola cookies lintas situs yang dipilih pengguna. Akses dilakukan saat pengguna membuka popup/editor atau menerapkan aksi. |
| `tabs` | Mengetahui tab asal, membuka editor, dan memuat ulang tab setelah import. |
| `activeTab` | Akses tab saat pengguna berinteraksi dengan action extension. |
| `webNavigation` | Mengidentifikasi URL frame pada tab aktif untuk pencarian cookies sub-frame. |
| `contextMenus` | Menambahkan menu pada ikon extension. |
| `storage` | Menyimpan preferensi lokal (tema, auto-refresh, konflik, dan tampilan value). |
| `clipboardWrite` | Menyalin ekspor cookie ke clipboard setelah pengguna memilih aksi tersebut. |

Mode incognito menggunakan `spanning`; aktifkan **Allow in incognito** pada halaman pengelolaan extension bila memang diperlukan. Cookie store incognito terpisah dari store normal.

## Penggunaan cookie dan keamanan

Cookie sesi dapat berfungsi sebagai kredensial. Ekspor hanya cookies akun milik Anda atau yang penggunaannya telah diizinkan. Simpan file ekspor secara aman dan hapus setelah digunakan. Import menampilkan pratinjau serta peringatan, dan browser tetap dapat menolak cookie berdasarkan aturan domain atau atribut keamanan. Jangan membagikan file cookie.

Nilai cookie ditampilkan tersamarkan secara default di editor dan UI merender input sebagai teks. File input dibatasi 10 MB. Extension tidak mendekripsi nilai `encrypted_value` dari database Chrome. Cookie sesi mungkin tidak dapat dipindahkan jika situs mengikat sesi ke perangkat, IP, atau user agent, atau telah mencabut token.

Brave Shields atau kebijakan browser dapat memblokir cookie pihak ketiga. Extension hanya menampilkan cookies yang benar-benar tersedia pada cookie store. Cookies di halaman internal browser atau halaman khusus tertentu tidak dapat diakses.

## Catatan kompatibilitas

Target adalah Chrome 120+ dan Brave berbasis Chromium yang setara. Partitioned cookies ditangani best-effort bergantung API dan izin browser. Tidak ada dukungan Firefox/Safari maupun localStorage, sessionStorage, atau IndexedDB.
