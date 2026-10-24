'use strict';

const API_URL = 'https://api-web.dnccudinus.org/api/mobil';
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80';

const elements = {
  grid: document.getElementById('carGrid'),
  status: document.getElementById('apiStatus'),
  resultCount: document.getElementById('resultCount'),
  search: document.getElementById('searchInput'),
  brand: document.getElementById('brandFilter'),
  fuel: document.getElementById('fuelFilter'),
  sort: document.getElementById('sortSelect'),
  empty: document.getElementById('emptyState'),
  reset: document.getElementById('resetFilters'),
  clear: document.getElementById('clearFilters'),
  dialog: document.getElementById('carDialog'),
  dialogContent: document.getElementById('dialogContent'),
  dialogClose: document.getElementById('dialogClose'),
  toast: document.getElementById('toast'),
  menuToggle: document.getElementById('menuToggle'),
  nav: document.getElementById('mainNav')
};

let cars = [];
let toastTimeout;

function safeText(value, fallback = 'Informasi belum tersedia') {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  return String(value);
}

function formatRupiah(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 'Harga belum tersedia';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
  }).format(amount).replace('Rp', 'Rp ');
}

function normalizeStatus(value) {
  const status = String(value || '').toLowerCase();
  if (status === 'tersedia' || status === 'available') return 'tersedia';
  if (status === 'sold' || status === 'terjual') return 'sold';
  return status || 'unknown';
}

function statusLabel(value) {
  const status = normalizeStatus(value);
  if (status === 'tersedia') return 'Tersedia';
  if (status === 'sold') return 'Terjual';
  return status === 'unknown' ? 'Status belum tersedia' : status;
}

function validPhoto(value) {
  if (typeof value !== 'string' || !value.trim()) return FALLBACK_IMAGE;
  try {
    const url = new URL(value, window.location.href);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : FALLBACK_IMAGE;
  } catch {
    return FALLBACK_IMAGE;
  }
}

function setStatus(message, state = 'loading') {
  elements.status.className = `api-status ${state}`;
  elements.status.replaceChildren();
  const spinner = document.createElement('span');
  spinner.className = 'status-spinner';
  spinner.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.textContent = message;
  elements.status.append(spinner, text);
}

function populateFilter(select, values, defaultLabel) {
  const previousValue = select.value;
  select.replaceChildren();
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = defaultLabel;
  select.append(defaultOption);
  [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'id'))
    .forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.append(option);
    });
  if ([...select.options].some(option => option.value === previousValue)) select.value = previousValue;
}

function initializeFilters() {
  populateFilter(elements.brand, cars.map(car => car.brand), 'Semua merek');
  populateFilter(elements.fuel, cars.map(car => car.bahan_bakar), 'Semua bahan bakar');
}

function createSpec(text) {
  const span = document.createElement('span');
  span.textContent = text;
  return span;
}

function createCarCard(car, index) {
  const card = document.createElement('article');
  card.className = 'car-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Lihat detail ${safeText(car.nama, 'mobil')}`);
  card.style.animationDelay = `${Math.min(index * 45, 270)}ms`;

  const photoWrap = document.createElement('div');
  photoWrap.className = 'car-photo-wrap';
  const photo = document.createElement('img');
  photo.className = 'car-photo';
  photo.src = validPhoto(car.foto);
  photo.alt = safeText(car.nama, 'Foto mobil');
  photo.loading = 'lazy';
  photo.decoding = 'async';
  photo.addEventListener('error', () => {
    if (photo.src !== FALLBACK_IMAGE) photo.src = FALLBACK_IMAGE;
  }, { once: true });

  const badge = document.createElement('span');
  const status = normalizeStatus(car.status);
  badge.className = `car-badge${status === 'sold' ? ' sold' : ''}`;
  badge.textContent = statusLabel(car.status);
  const open = document.createElement('button');
  open.className = 'card-open';
  open.type = 'button';
  open.setAttribute('aria-label', `Buka detail ${safeText(car.nama, 'mobil')}`);
  open.textContent = '↗';
  open.addEventListener('click', event => {
    event.stopPropagation();
    showDetails(car);
  });
  photoWrap.append(photo, badge, open);

  const info = document.createElement('div');
  info.className = 'car-info';
  const meta = document.createElement('div');
  meta.className = 'car-meta';
  const brand = document.createElement('span');
  brand.textContent = safeText(car.brand, 'Merek tidak tersedia');
  const year = document.createElement('span');
  year.textContent = safeText(car.tahun, '—');
  meta.append(brand, year);
  const title = document.createElement('h3');
  title.className = 'car-title';
  title.textContent = safeText(car.nama, 'Nama mobil tidak tersedia');
  const specs = document.createElement('div');
  specs.className = 'car-specs';
  specs.append(
    createSpec(safeText(car.transmisi, 'Transmisi —')),
    createSpec(safeText(car.bahan_bakar, 'Bahan bakar —'))
  );
  const priceRow = document.createElement('div');
  priceRow.className = 'car-price-row';
  const priceGroup = document.createElement('div');
  const priceLabel = document.createElement('div');
  priceLabel.className = 'car-price-label';
  priceLabel.textContent = 'HARGA';
  const price = document.createElement('div');
  price.className = 'car-price';
  price.textContent = formatRupiah(car.harga);
  priceGroup.append(priceLabel, price);
  const detail = document.createElement('span');
  detail.className = 'detail-link';
  detail.textContent = 'Detail ';
  const arrow = document.createElement('span');
  arrow.textContent = '→';
  detail.append(arrow);
  priceRow.append(priceGroup, detail);
  info.append(meta, title, specs, priceRow);
  card.append(photoWrap, info);

  card.addEventListener('click', () => showDetails(car));
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showDetails(car);
    }
  });
  return card;
}

function getFilteredCars() {
  const query = elements.search.value.trim().toLocaleLowerCase('id');
  const brand = elements.brand.value;
  const fuel = elements.fuel.value;
  const filtered = cars.filter(car => {
    const searchable = [car.nama, car.brand, car.tahun, car.transmisi, car.bahan_bakar, car.status]
      .map(value => String(value ?? '')).join(' ').toLocaleLowerCase('id');
    return (!query || searchable.includes(query)) &&
      (!brand || String(car.brand || '') === brand) &&
      (!fuel || String(car.bahan_bakar || '') === fuel);
  });

  switch (elements.sort.value) {
    case 'price-asc': filtered.sort((a, b) => Number(a.harga || 0) - Number(b.harga || 0)); break;
    case 'price-desc': filtered.sort((a, b) => Number(b.harga || 0) - Number(a.harga || 0)); break;
    case 'year-desc': filtered.sort((a, b) => Number(b.tahun || 0) - Number(a.tahun || 0)); break;
    case 'name-asc': filtered.sort((a, b) => String(a.nama || '').localeCompare(String(b.nama || ''), 'id')); break;
    default: filtered.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  }
  return filtered;
}

function renderCars() {
  const filteredCars = getFilteredCars();
  const fragment = document.createDocumentFragment();
  filteredCars.forEach((car, index) => fragment.append(createCarCard(car, index)));
  elements.grid.replaceChildren(fragment);
  elements.resultCount.textContent = String(filteredCars.length).padStart(2, '0');
  elements.empty.hidden = filteredCars.length !== 0;
  elements.grid.hidden = filteredCars.length === 0;
  if (cars.length > 0) {
    setStatus(`Menampilkan ${filteredCars.length} dari ${cars.length} kendaraan dari API resmi.`, 'success');
  }
}

function addDialogSpec(container, label, value) {
  const item = document.createElement('div');
  item.className = 'dialog-spec';
  const small = document.createElement('small');
  small.textContent = label;
  const strong = document.createElement('strong');
  strong.textContent = value;
  item.append(small, strong);
  container.append(item);
}

function showDetails(car) {
  elements.dialogContent.replaceChildren();
  const image = document.createElement('img');
  image.className = 'dialog-image';
  image.src = validPhoto(car.foto);
  image.alt = safeText(car.nama, 'Foto mobil');
  image.addEventListener('error', () => { image.src = FALLBACK_IMAGE; }, { once: true });

  const details = document.createElement('div');
  details.className = 'dialog-details';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = `${safeText(car.brand, 'VELTRON SELECTION')} / VEHICLE DETAILS`;
  const title = document.createElement('h2');
  title.id = 'dialogTitle';
  title.textContent = safeText(car.nama, 'Detail kendaraan');
  const status = document.createElement('p');
  status.className = 'car-meta';
  status.textContent = `STATUS: ${statusLabel(car.status).toUpperCase()}`;
  const price = document.createElement('div');
  price.className = 'dialog-price';
  price.textContent = formatRupiah(car.harga);
  const specs = document.createElement('div');
  specs.className = 'dialog-specs';
  addDialogSpec(specs, 'Tahun', safeText(car.tahun, '—'));
  addDialogSpec(specs, 'Merek', safeText(car.brand, '—'));
  addDialogSpec(specs, 'Transmisi', safeText(car.transmisi, '—'));
  addDialogSpec(specs, 'Bahan bakar', safeText(car.bahan_bakar, '—'));
  addDialogSpec(specs, 'Status', statusLabel(car.status));
  addDialogSpec(specs, 'ID kendaraan', safeText(car.id, '—'));
  const note = document.createElement('p');
  note.className = 'dialog-note';
  note.textContent = 'Informasi kendaraan ditampilkan berdasarkan data yang disediakan oleh API. Ketersediaan dan harga dapat berubah.';
  details.append(eyebrow, title, status, price, specs, note);
  elements.dialogContent.append(image, details);
  if (typeof elements.dialog.showModal === 'function') {
    elements.dialog.showModal();
    document.body.classList.add('dialog-open');
  } else {
    showToast('Browser ini tidak mendukung tampilan detail dialog. Coba gunakan browser terbaru.');
  }
}

function resetFilters() {
  elements.search.value = '';
  elements.brand.value = '';
  elements.fuel.value = '';
  elements.sort.value = 'featured';
  renderCars();
}

function showToast(message) {
  window.clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  toastTimeout = window.setTimeout(() => elements.toast.classList.remove('show'), 2600);
}

async function loadCars() {
  setStatus('Menghubungkan ke koleksi kendaraan...', 'loading');
  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Server merespons HTTP ${response.status}`);
    const payload = await response.json();
    if (payload && payload.success === false) throw new Error(payload.message || 'API melaporkan permintaan gagal.');
    const rows = Array.isArray(payload) ? payload : payload?.data;
    if (!Array.isArray(rows)) throw new Error('Format data API tidak sesuai harapan.');
    cars = rows.filter(item => item && typeof item === 'object');
    if (cars.length === 0) {
      elements.grid.replaceChildren();
      elements.resultCount.textContent = '00';
      elements.empty.hidden = false;
      elements.grid.hidden = true;
      setStatus('API berhasil dihubungi, tetapi belum ada data mobil untuk ditampilkan.', 'success');
      return;
    }
    initializeFilters();
    renderCars();
  } catch (error) {
    console.error('Gagal mengambil data mobil dari API:', error);
    elements.grid.replaceChildren();
    elements.resultCount.textContent = '00';
    elements.grid.hidden = true;
    elements.empty.hidden = false;
    const heading = elements.empty.querySelector('h3');
    const message = elements.empty.querySelector('p');
    heading.textContent = 'Koleksi belum dapat dimuat.';
    message.textContent = 'Periksa koneksi internet atau coba jalankan website melalui VS Code Live Server. Data tidak diganti dengan data contoh.';
    setStatus('Tidak dapat mengambil data dari API. Silakan coba lagi.', 'error');
    const retry = document.createElement('button');
    retry.className = 'button button-outline';
    retry.type = 'button';
    retry.textContent = 'Coba lagi';
    retry.addEventListener('click', () => {
      elements.empty.hidden = true;
      elements.grid.hidden = false;
      loadCars();
    });
    elements.empty.append(retry);
  }
}

elements.search.addEventListener('input', renderCars);
elements.brand.addEventListener('change', renderCars);
elements.fuel.addEventListener('change', renderCars);
elements.sort.addEventListener('change', renderCars);
elements.reset.addEventListener('click', resetFilters);
elements.clear.addEventListener('click', resetFilters);
elements.dialogClose.addEventListener('click', () => elements.dialog.close());
elements.dialog.addEventListener('click', event => {
  if (event.target === elements.dialog) elements.dialog.close();
});
elements.dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
elements.menuToggle.addEventListener('click', () => {
  const isOpen = elements.nav.classList.toggle('open');
  elements.menuToggle.setAttribute('aria-expanded', String(isOpen));
  elements.menuToggle.setAttribute('aria-label', isOpen ? 'Tutup navigasi' : 'Buka navigasi');
});
elements.nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  elements.nav.classList.remove('open');
  elements.menuToggle.setAttribute('aria-expanded', 'false');
  elements.menuToggle.setAttribute('aria-label', 'Buka navigasi');
}));

loadCars();
