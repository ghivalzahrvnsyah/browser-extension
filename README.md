<p align="center">
  <img src="assets/icons/512.png" alt="Logo Megamendung Cookies" width="160">
</p>

<h1 align="center">Megamendung Cookies</h1>

Megamendung Cookies adalah extension Manifest V3 untuk melihat, mengedit, mengimpor, dan mengekspor cookies secara lokal. Extension dibuat dengan HTML, CSS, dan JavaScript vanilla, tanpa framework atau proses build.

## Mulai menggunakan

### Instalasi dari source

1. Buka `brave://extensions` atau `chrome://extensions`.
2. Aktifkan **Developer mode**.
3. Klik **Load unpacked**, lalu pilih folder proyek ini.
4. Buka situs yang cookies-nya ingin dikelola dan klik ikon **Megamendung Cookies**.

Popup menampilkan cookies tab aktif. Klik **Editor** untuk membuka tampilan lengkap. Setelah mengubah source code, tekan tombol reload pada halaman pengelolaan extension.

## Mengimpor cookies

1. Klik **Import** di popup, atau **Import cookies** di editor.
2. Tempel data cookie atau pilih file hingga 10 MB.
3. Pilih strategi konflik dan cakupan domain bila diperlukan.
4. Klik **Import cookies**. Extension langsung memproses data dan melaporkan jumlah yang berhasil atau gagal.

Popup mendeteksi format secara otomatis. Di editor, format juga dapat dipilih secara manual. Cookie yang sudah ada dapat ditimpa atau dilewati. Extension meminta konfirmasi sebelum menimpa cookie yang cocok.

Format yang didukung:

- JSON Megamendung dan array JSON umum.
- Playwright/Puppeteer `storageState`.
- Netscape `cookies.txt`.
- Cookie header dan `Set-Cookie`.
- HAR.
- JSON dengan field bergaya database cookies Chrome. Nilai `encrypted_value` tidak didekripsi dan cookie tersebut dilewati.

## Mengekspor cookies

Klik **Export**, pilih format, lalu salin hasil ke clipboard atau unduh sebagai file. Popup mengekspor cookies tab aktif; editor dapat mengekspor cookies terpilih atau hasil filter. Format yang tersedia:

- JSON cookies (array), kompatibel dengan format cookie umum.
- JSON Megamendung dengan metadata ekspor.
- Netscape `cookies.txt`.
- Cookie header.

Sebelum ekspor, extension meminta konfirmasi karena file dapat berisi kredensial sesi.

## Fitur

- Membaca cookies tab aktif, termasuk frame yang dapat diakses, dan menampilkan flag Secure, HttpOnly, SameSite, serta sumber frame.
- Melihat cookies berdasarkan tab aktif, domain, atau seluruh domain; mencari, mengurutkan, dan menyaring daftar.
- Menambah, mengedit, dan menghapus cookies satu per satu, terpilih, atau per domain.
- Mendukung pemilihan cookie store, termasuk store incognito bila extension diizinkan berjalan dalam mode incognito.
- Mengatur tema Light, Dark, atau System dan preferensi auto-refresh setelah import.
- Auto-refresh setelah menghapus cookie dapat diaktifkan lewat checkbox di popup atau editor.
- Menyediakan menu konteks pada ikon extension untuk membuka editor dengan domain tab aktif.

## Privasi dan keamanan

Semua pemrosesan berjalan di browser. Extension tidak mengirim cookies ke server dan tidak membuat permintaan jaringan atau telemetri.

Cookies sesi berfungsi seperti kredensial akun. Gunakan extension hanya untuk akun milik Anda atau akun yang penggunaannya telah diizinkan. Simpan file ekspor dengan aman dan jangan membagikannya. Hapus file setelah selesai digunakan.

Nilai cookies tersamarkan secara default di editor. Data impor dirender sebagai teks, dibatasi hingga 10 MB, dan divalidasi sebelum diterapkan. Browser atau situs tetap dapat menolak cookie karena aturan keamanan, domain, masa berlaku, atau pengikatan sesi ke perangkat, IP, maupun user agent.

## Izin yang diminta

| Izin | Kegunaan |
|---|---|
| `cookies` | Membaca, membuat, dan menghapus cookies. |
| Host permission `<all_urls>` | Mengelola cookies pada situs yang dipilih pengguna; diperlukan oleh `chrome.cookies`. |
| `tabs` | Mengidentifikasi tab asal, membuka editor, dan memuat ulang tab setelah import. |
| `activeTab` | Memberi akses ke tab saat pengguna berinteraksi dengan extension. |
| `webNavigation` | Menemukan URL frame pada tab aktif. |
| `contextMenus` | Menambahkan menu pada ikon extension. |
| `storage` | Menyimpan tema dan preferensi lokal. |
| `clipboardWrite` | Menyalin hasil ekspor setelah pengguna memilih aksi salin. |

Extension menggunakan mode incognito `spanning`. Untuk mengelola cookies incognito, aktifkan **Allow in incognito** pada halaman pengelolaan extension. Cookie store incognito terpisah dari store normal.

## Kompatibilitas dan batasan

Target extension adalah Chrome 120+ dan Brave berbasis Chromium. Cookies di halaman internal browser atau halaman khusus tertentu tidak dapat diakses. Partitioned cookies ditangani sebaik mungkin sesuai dukungan browser. Firefox, Safari, localStorage, sessionStorage, dan IndexedDB tidak didukung.

## Teknologi

- JavaScript vanilla
- HTML5 dan CSS3
- Chrome Extension Manifest V3
- Browser berbasis Chromium

## Lisensi

All rights reserved unless otherwise specified.

## Author

Ghivalza Harviansyah
