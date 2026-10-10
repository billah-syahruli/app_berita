const URL_API = "https://berita-indo-api-next.vercel.app/api/cnn-news"

// kategori diambil dari bagian URL artikel (cnnindonesia.com/<kategori>/...)
const KATEGORI = [
    { id: "semua", nama: "Terbaru" },
    { id: "nasional", nama: "Nasional" },
    { id: "internasional", nama: "Internasional" },
    { id: "ekonomi", nama: "Ekonomi" },
    { id: "olahraga", nama: "Olahraga" },
    { id: "teknologi", nama: "Teknologi" },
    { id: "hiburan", nama: "Hiburan" },
    { id: "gaya-hidup", nama: "Gaya hidup" },
    { id: "otomotif", nama: "Otomotif" },
    { id: "tv", nama: "Video" }
]

const state = { semua: [], kat: "semua", q: "", lingkup: "kategori" }

const $ = s => document.querySelector(s)
const jeda = ms => new Promise(r => setTimeout(r, ms))
const el = (tag, kelas, teks) => {
    const n = document.createElement(tag)
    if (kelas) n.className = kelas
    if (teks != null) n.textContent = teks
    return n
}

const wadah = $("#berita")
const jalur = $("#nav-jalur")
const input = $("#cari")
const namaKat = id => (KATEGORI.find(k => k.id === id) || {}).nama || id

/* ---------- Teks yang muncul huruf per huruf ---------- */
function pecah(node, teks) {
    node.textContent = ""
    node.setAttribute("aria-label", teks)
    let i = 0
    teks.split(" ").forEach((kata, n, arr) => {
        const k = el("span", "kata")
        k.setAttribute("aria-hidden", "true")
        for (const h of kata) {
            const s = el("span", "huruf", h)
            s.style.setProperty("--i", i++)
            k.append(s)
        }
        node.append(k)
        if (n < arr.length - 1) node.append(" ")
    })
}

/* ---------- Data ---------- */
function normal(d) {
    const gbr = typeof d.image === "string" ? d.image : (d.image && (d.image.small || d.image.large)) || ""
    const kat = (String(d.link).match(/cnnindonesia\.com\/([^/]+)\//) || [])[1] || "lainnya"
    return { judul: d.title, link: d.link, ringkas: d.contentSnippet || "", waktu: d.isoDate || d.isoData, gambar: gbr, kat }
}

async function ambil() {
    for (let i = 0; i < 2; i++) {
        const c = new AbortController()
        const t = setTimeout(() => c.abort(), 8000)
        try {
            const res = await fetch(URL_API, { signal: c.signal })
            if (!res.ok) throw new Error("HTTP " + res.status)
            const json = await res.json()
            const arr = Array.isArray(json.data) ? json.data : []
            state.semua = arr.filter(d => d.title && d.link).map(normal)
                .sort((a, b) => new Date(b.waktu) - new Date(a.waktu))
            if (!state.semua.length) throw new Error("kosong")
            try { localStorage.setItem("berita-cache", JSON.stringify(state.semua)) } catch (e) {}
            return
        } catch (e) {
            if (i) throw e
        } finally {
            clearTimeout(t)
        }
    }
}

function waktu(iso) {
    const d = new Date(iso)
    const s = (Date.now() - d) / 1000
    if (isNaN(s)) return ""
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + " menit lalu"
    if (s < 86400) return Math.round(s / 3600) + " jam lalu"
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}

function daftar() {
    const q = state.q.trim().toLowerCase()
    let l = state.semua
    if ((!q || state.lingkup === "kategori") && state.kat !== "semua") l = l.filter(x => x.kat === state.kat)
    if (q) l = l.filter(x => (x.judul + " " + x.ringkas).toLowerCase().includes(q))
    return l
}

/* ---------- Render ---------- */
function sorot(teks, q) {
    if (!q) return [teks]
    const re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig")
    return teks.split(re).map((s, i) => (i % 2 ? el("mark", null, s) : s))
}

function kartu(d, q) {
    const a = el("article")

    const g = el("div", "gambar")
    if (d.gambar) {
        const im = new Image()
        im.alt = ""
        im.loading = "lazy"
        im.decoding = "async"
        im.onload = () => { im.classList.add("termuat"); g.classList.add("siap") }
        im.onerror = () => { im.remove(); g.classList.add("siap") }
        im.src = d.gambar
        g.append(im)
    } else {
        g.classList.add("siap")
    }

    const isi = el("div", "isi")
    const meta = el("div", "meta")
    const tag = el("span", "tag", namaKat(d.kat))
    const jam = el("time", null, waktu(d.waktu))
    jam.dateTime = d.waktu
    meta.append(tag, jam)

    const h3 = el("h3")
    h3.append(...sorot(d.judul, q))

    const bagian = [meta, h3]
    if (d.ringkas && d.ringkas.toLowerCase() !== d.judul.toLowerCase()) bagian.push(el("p", "ringkas", d.ringkas))

    const baca = el("a", "baca", "Baca selengkapnya")
    baca.href = d.link
    baca.target = "_blank"
    baca.rel = "noopener"
    bagian.push(baca)

    bagian.forEach((n, i) => { n.style.setProperty("--k", i); isi.append(n) })
    a.append(g, isi)
    return a
}

function pesan(judul, teks, tombol = []) {
    const p = el("div", "pesan")
    p.append(el("h3", null, judul), el("p", null, teks))
    const grup = el("div", "tombol-grup")
    tombol.forEach(([label, fn]) => {
        const b = el("button", null, label)
        b.type = "button"
        b.onclick = fn
        grup.append(b)
    })
    if (tombol.length) p.append(grup)
    wadah.replaceChildren(p)
}

let io
function amati() {
    if (io) io.disconnect()
    const semua = [...wadah.querySelectorAll("article:not(.skel)")]
    if (!("IntersectionObserver" in window)) return semua.forEach(a => a.classList.add("tampil"))
    io = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("tampil"); io.unobserve(e.target) }
    }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 })
    semua.forEach((a, i) => { a.style.setProperty("--tunda", (i % 3) * 120 + "ms"); io.observe(a) })
}

let hitungId
function hitung(node, n) {
    cancelAnimationFrame(hitungId)
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { node.textContent = n + " berita"; return }
    const t0 = performance.now()
    const langkah = t => {
        const p = Math.min(1, (t - t0) / 700)
        node.textContent = Math.round(n * (1 - Math.pow(1 - p, 3))) + " berita"
        if (p < 1) hitungId = requestAnimationFrame(langkah)
    }
    hitungId = requestAnimationFrame(langkah)
}

function tampilkan() {
    const l = daftar()
    const q = state.q.trim()
    hitung($("#seksi-info"), l.length)

    if (!l.length) {
        const tombol = q
            ? [["Hapus pencarian", () => { input.value = ""; input.dispatchEvent(new Event("input")) }]]
            : [["Lihat semua berita", () => pilih("semua")]]
        return pesan("Berita tidak ditemukan", q ? `Tidak ada hasil untuk "${q}".` : "Belum ada berita di kategori ini.", tombol)
    }

    wadah.replaceChildren()
    let sisa = l
    if (!q) {
        const u = kartu(l[0], "")
        u.classList.add("utama")
        wadah.append(u)
        sisa = l.slice(1)
    }
    const grid = el("div", "lain")
    sisa.forEach(d => grid.append(kartu(d, q)))
    wadah.append(grid)
    amati()
}

function skeleton() {
    const grid = el("div", "lain")
    for (let i = 0; i < 6; i++) {
        const a = el("article", "skel tampil")
        const isi = el("div", "isi")
        isi.append(el("div", "garis-skel"), el("div", "garis-skel"), el("div", "garis-skel pendek"))
        a.append(el("div", "gambar"), isi)
        grid.append(a)
    }
    wadah.replaceChildren(grid)
}

/* ---------- Judul seksi, navigasi, pencarian ---------- */
let judulSkrg = ""
function judul() {
    const nama = state.q.trim() ? "Hasil pencarian" : namaKat(state.kat)
    if (nama !== judulSkrg) {
        const h = $("#seksi-nama")
        h.style.setProperty("--dasar", judulSkrg ? "0ms" : "950ms")
        pecah(h, nama)
        judulSkrg = nama
    }
}

const ind = $("#nav-indikator")
KATEGORI.forEach((k, i) => {
    const a = el("a", "a" + (k.id === state.kat ? " aktif" : ""), k.nama)
    a.href = "#" + k.id
    a.dataset.id = k.id
    a.style.setProperty("--i", i)
    jalur.append(a)
})

function geser() {
    const a = jalur.querySelector(".aktif")
    if (!a) return
    ind.style.width = a.offsetWidth + "px"
    ind.style.transform = `translateX(${a.offsetLeft}px)`
}

let tukar
function pilih(id) {
    state.kat = id
    jalur.querySelectorAll("a").forEach(a => a.classList.toggle("aktif", a.dataset.id === id))
    geser()
    jalur.querySelector(".aktif").scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" })
    judul()
    wadah.classList.add("keluar")
    clearTimeout(tukar)
    tukar = setTimeout(() => { tampilkan(); wadah.classList.remove("keluar") }, 170)
    const atas = $(".seksi-kepala").offsetTop - 90
    if (scrollY > atas) scrollTo({ top: atas, behavior: "smooth" })
}

jalur.addEventListener("click", e => {
    const a = e.target.closest("a")
    if (!a) return
    e.preventDefault()
    pilih(a.dataset.id)
})
addEventListener("resize", geser)

$("#form-cari").addEventListener("submit", e => e.preventDefault())
let tunda
input.addEventListener("input", () => {
    const ada = input.value.trim() !== ""
    $(".cari").classList.toggle("berisi", input.value !== "")
    $(".cari-opsi").hidden = !ada
    clearTimeout(tunda)
    tunda = setTimeout(() => { state.q = input.value; judul(); tampilkan() }, 180)
})
$("#cari-hapus").onclick = () => { input.value = ""; input.dispatchEvent(new Event("input")); input.focus() }

document.querySelector(".cari-opsi").addEventListener("click", e => {
    const b = e.target.closest("button")
    if (!b) return
    state.lingkup = b.dataset.scope === "semua" ? "semua" : "kategori"
    document.querySelectorAll(".cari-opsi button").forEach(x => x.classList.toggle("aktif", x === b))
    tampilkan()
})

addEventListener("keydown", e => {
    const mengetik = /INPUT|TEXTAREA/.test(document.activeElement.tagName)
    if (e.key === "/" && !mengetik) { e.preventDefault(); input.focus() }
    if (e.key === "Escape" && document.activeElement === input) { input.value = ""; input.dispatchEvent(new Event("input")); input.blur() }
})

/* ---------- Tema gelap / terang ---------- */
const root = document.documentElement
const btnTema = $("#tema")
function setTema(t) {
    root.dataset.tema = t
    btnTema.textContent = t === "gelap" ? "Mode terang" : "Mode gelap"
    btnTema.setAttribute("aria-pressed", t === "gelap")
}
let simpan = null
try { simpan = localStorage.getItem("tema") } catch (e) {}
setTema(simpan || (matchMedia("(prefers-color-scheme: dark)").matches ? "gelap" : "terang"))
btnTema.onclick = () => {
    const t = root.dataset.tema === "gelap" ? "terang" : "gelap"
    const ubah = () => {
        setTema(t)
        try { localStorage.setItem("tema", t) } catch (e) {}
    }
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
        root.classList.add("ganti-tema")
        ubah()
        setTimeout(() => root.classList.remove("ganti-tema"), 600)
        return
    }
    const r = btnTema.getBoundingClientRect()
    const x = r.left + r.width / 2, y = r.top + r.height / 2
    const rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    document.startViewTransition(ubah).ready.then(() => root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] },
        { duration: 800, easing: "cubic-bezier(.2,.7,.2,1)", pseudoElement: "::view-transition-new(root)" }
    ))
}

/* ---------- Progress baca + tombol ke atas ---------- */
const prog = $("#progress")
const naik = $("#naik")
const cincin = naik.querySelector(".cincin")
let menunggu = false
function gulir() {
    menunggu = false
    const maks = root.scrollHeight - innerHeight
    const p = maks > 0 ? Math.min(1, scrollY / maks) : 0
    prog.style.transform = `scaleX(${p})`
    cincin.style.strokeDashoffset = 119.4 * (1 - p)
    naik.classList.toggle("tampil", scrollY > 600)
    if (scrollY < 800) judulBesar.style.transform = `translateY(${scrollY * 0.16}px)`
}
const judulBesar = $("#judul")
addEventListener("scroll", () => { if (!menunggu) { menunggu = true; requestAnimationFrame(gulir) } }, { passive: true })
naik.onclick = () => scrollTo({ top: 0, behavior: "smooth" })

/* ---------- Spotlight + tilt kartu, cahaya kursor ---------- */
if (matchMedia("(hover: hover)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    wadah.addEventListener("pointermove", e => {
        const a = e.target.closest("article:not(.skel)")
        if (!a) return
        const r = a.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height
        a.style.setProperty("--mx", px * 100 + "%")
        a.style.setProperty("--my", py * 100 + "%")
        a.style.setProperty("--ry", (px - 0.5) * 6 + "deg")
        a.style.setProperty("--rx", (0.5 - py) * 5 + "deg")
    })
    wadah.addEventListener("pointerout", e => {
        const a = e.target.closest("article")
        if (a && !a.contains(e.relatedTarget)) { a.style.setProperty("--rx", "0deg"); a.style.setProperty("--ry", "0deg") }
    })
    const kepala = $(".kepala")
    kepala.addEventListener("pointermove", e => {
        const r = kepala.getBoundingClientRect()
        kepala.style.setProperty("--gx", e.clientX - r.left + "px")
        kepala.style.setProperty("--gy", e.clientY - r.top + "px")
    })
}

/* ---------- Header & ticker ---------- */
function isiHeader() {
    const skrg = new Date()
    $(".kepala-bawah").textContent = "Kumpulan kabar terbaru dari CNN Indonesia, diperbarui pukul " + skrg.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    const isi = $("#ticker-isi")
    isi.replaceChildren()
    const judulTop = state.semua.slice(0, 12)
    // dua salinan supaya geseran -50% terlihat tanpa putus
    ;[0, 1].forEach(n => judulTop.forEach(d => {
        const a = el("a", null, d.judul)
        a.href = d.link
        a.target = "_blank"
        a.rel = "noopener"
        if (n) { a.setAttribute("aria-hidden", "true"); a.tabIndex = -1 }
        isi.append(a)
    }))
    $(".ticker").style.display = ""
}

function toast(teks) {
    const t = el("div", "toast", teks)
    t.setAttribute("role", "status")
    document.body.append(t)
    setTimeout(() => t.classList.add("keluar"), 2600)
    setTimeout(() => t.remove(), 3300)
}

function galat() {
    $(".ticker").style.display = "none"
    $(".kepala-bawah").textContent = "Berita belum bisa dimuat"
    pesan("Berita gagal dimuat", "Periksa koneksi internet kamu, lalu coba lagi.", [["Coba lagi", muatUlang]])
}

async function muatUlang() {
    skeleton()
    try { await ambil(); isiHeader(); tampilkan() } catch (e) { console.error(e); galat() }
}

/* ---------- Mulai ---------- */
async function mulai() {
    $("#tanggal").textContent = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    pecah($("#pre-judul"), "Berita")
    pecah($("#judul"), "Berita Hari Ini")
    judul()
    // jangan menunggu font lama-lama
    if (document.fonts) await Promise.race([document.fonts.ready, jeda(250)]).catch(() => {})
    geser()
    requestAnimationFrame(() => requestAnimationFrame(() => ind.classList.add("siap")))

    // kunjungan berikutnya: tampilkan berita tersimpan dulu, perbarui di belakang layar
    let cache = null
    try { cache = JSON.parse(localStorage.getItem("berita-cache")) } catch (e) {}
    const adaCache = Array.isArray(cache) && cache.length > 0
    if (adaCache) state.semua = cache
    const linkLama = adaCache ? cache[0].link : ""

    let gagal = false, selesai = adaCache, pct = 0
    const t0 = performance.now()
    const persen = $("#pre-persen"), isiBar = $(".pre-garis span"), status = $(".pre-status")
    const kata = ["Menghubungi server...", "Mengambil berita terbaru...", "Menyusun halaman..."]
    const tik = setInterval(() => {
        pct += ((selesai ? 100 : 90) - pct) * (selesai ? 0.3 : 0.1)
        if (selesai && pct > 99.4) pct = 100
        if (persen) persen.textContent = Math.round(pct)
        isiBar.style.width = pct + "%"
        if (!selesai) {
            const t = kata[pct < 30 ? 0 : pct < 65 ? 1 : 2]
            if (status.textContent !== t) status.textContent = t
        }
    }, 40)

    const ambilData = ambil().then(() => true, e => { console.error(e); return false })
    if (!adaCache) gagal = !(await ambilData)
    selesai = true
    const sisa = (adaCache ? 700 : 1300) - (performance.now() - t0)
    if (sisa > 0) await jeda(sisa)
    while (pct < 100) await jeda(30)
    clearInterval(tik)
    status.textContent = gagal ? "Gagal memuat berita" : "Siap dibaca"
    await jeda(150)
    $("#preloader").classList.add("selesai")
    await jeda(250)
    document.body.classList.add("mulai")

    if (gagal) galat()
    else { isiHeader(); tampilkan() }
    gulir()
    setTimeout(() => $("#preloader").remove(), 1000)

    if (adaCache) ambilData.then(ok => {
        if (ok && state.semua[0].link !== linkLama) { isiHeader(); tampilkan(); toast("Berita diperbarui") }
    })
}

mulai()