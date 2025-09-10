// ===============================================================================
// IMPORTS E INICIALIZAÇÃO DO FIREBASE
// ===============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    onSnapshot,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);
const appId = firebaseConfig.projectId;

// ===============================================================================
// ESTADO DA APLICAÇÃO
// ===============================================================================
let appState = {
    pageContent: { home: {}, about: {} },
    calendarEvents: [],
    products: [],
    news: [],
    registrations: [],
    galleryImages: [],
    orders: [],
    currentUser: null,
    loaders: {
        pageContent: true,
        calendarEvents: true,
        products: true,
        news: true,
        galleryImages: true,
        orders: true,
    }
};

let cart = [];

// ===============================================================================
// ELEMENTOS GLOBAIS
// ===============================================================================
const appRoot = document.getElementById('app-root');
const mobileMenuButton = document.getElementById('mobile-menu-button');
const mobileMenu = document.getElementById('mobile-menu');

// ===============================================================================
// FUNÇÕES DE UI (Notificações, Modals, Loaders)
// ===============================================================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    let bgColor = 'bg-green-500'; // success
    if (type === 'error') {
        bgColor = 'bg-red-600';
    } else if (type === 'info') {
        bgColor = 'bg-blue-500';
    }

    toast.className = `toast ${bgColor} text-white py-3 px-5 rounded-lg shadow-lg`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    toast.addEventListener('animationend', (e) => {
        if (e.animationName === 'fade-out') {
            toast.remove();
        }
    });
}

async function checkout() {
    if (cart.length === 0) {
        showToast('Seu carrinho está vazio!', 'error');
        return;
    }

    if (!appState.currentUser) {
        showToast('Você precisa estar logado para finalizar a compra.', 'info');
        navigateTo('login');
        return;
    }

    const order = {
        userId: appState.currentUser.uid,
        createdAt: new Date(),
        totalPrice: cart.reduce((total, item) => total + (item.price * item.quantity), 0),
        items: cart.map(item => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity }))
    };

    try {
        const collectionRef = collection(db, `artifacts/${appId}/public/data/orders`);
        await addDoc(collectionRef, order);
        showToast('Obrigado por sua compra!');
        cart = [];
        updateCartBadge();
        navigateTo('pedidos');
    } catch (error) {
        console.error("Erro ao finalizar compra: ", error);
        showToast('Houve um erro ao processar seu pedido.', 'error');
    }
}

function getSpinnerHTML() {
    return `<div class="spinner-container"><div class="spinner"></div></div>`;
}

// ===============================================================================
// RENDERIZAÇÃO DE PÁGINAS (Leitura do appState)
// ===============================================================================
function renderPage(templateId) {
    const template = document.getElementById(templateId);
    if (template) {
        appRoot.innerHTML = '';
        appRoot.appendChild(template.content.cloneNode(true));
    }
}

function renderHomePage() {
    renderPage('template-home');
    document.getElementById('home-headline').innerHTML = appState.loaders.pageContent ? '' : appState.pageContent.home.headline || "Vôlei Futuro";
    document.getElementById('home-subheadline').innerHTML = appState.loaders.pageContent ? '' : appState.pageContent.home.subheadline || "";

    const newsGrid = document.getElementById('home-news-grid');
    if (!newsGrid) return;

    if (appState.loaders.news) {
        newsGrid.innerHTML = getSpinnerHTML();
    } else {
        newsGrid.innerHTML = '';
        if (appState.news.length > 0) {
            appState.news.slice(0, 3).forEach(article => {
                newsGrid.innerHTML += `
                    <div class="bg-gray-900 rounded-lg overflow-hidden shadow-lg transform hover:-translate-y-2 transition duration-300">
                        <img src="${article.image}" alt="${article.title}" class="w-full h-48 object-cover">
                        <div class="p-6">
                            <span class="text-sm text-red-500">${article.date}</span>
                            <h3 class="text-xl font-bold mt-2 mb-3">${article.title}</h3>
                            <p class="text-gray-400 text-sm mb-4">${article.content}</p>
                            <a href="#noticias" class="font-semibold text-red-600 hover:text-red-500">Leia mais &rarr;</a>
                        </div>
                    </div>`;
            });
        } else {
            newsGrid.innerHTML = '<p class="text-center text-gray-400 col-span-3">Nenhuma notícia publicada.</p>';
        }
    }
}

function renderAboutPage() {
    renderPage('template-sobre');
    const missionText = document.getElementById('about-mission-text');
    if(appState.loaders.pageContent) {
        missionText.innerHTML = getSpinnerHTML();
    } else {
        missionText.innerHTML = appState.pageContent.about.mission || "Nossa missão...";
    }
}

function renderNewsPage() {
    renderPage('template-noticias');
    const newsGrid = document.getElementById('all-news-grid');
    if (!newsGrid) return;

    if (appState.loaders.news) {
        newsGrid.innerHTML = getSpinnerHTML();
    } else {
        if (appState.news.length === 0) {
            newsGrid.innerHTML = '<p class="text-center text-gray-400 col-span-3">Nenhuma notícia publicada.</p>';
            return;
        }
        newsGrid.innerHTML = '';
        appState.news.forEach(article => {
             newsGrid.innerHTML += `
                <div class="bg-gray-800 rounded-lg overflow-hidden shadow-lg">
                    <img src="${article.image}" alt="${article.title}" class="w-full h-48 object-cover">
                    <div class="p-6">
                        <span class="text-sm text-red-500">${article.date}</span>
                        <h3 class="text-xl font-bold mt-2 mb-3">${article.title}</h3>
                        <p class="text-gray-400 text-sm">${article.content}</p>
                    </div>
                </div>`;
        });
    }
}

function renderCalendarPage() {
    renderPage('template-calendario');
    const container = document.getElementById('calendar-container');
    if (!container) return;

    if (appState.loaders.calendarEvents) {
        container.innerHTML = getSpinnerHTML();
    } else {
        if (appState.calendarEvents.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-400">Nenhum evento agendado no momento.</p>';
            return;
        }
        container.innerHTML = [...appState.calendarEvents]
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(event => {
                const eventDate = new Date(event.date + 'T00:00:00-03:00');
                const day = eventDate.toLocaleDateString('pt-BR', { day: '2-digit' });
                const month = eventDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

                return `
                <div class="flex items-center border-b border-gray-700 py-4">
                    <div class="text-center mr-6 flex-shrink-0">
                        <p class="text-3xl font-bold text-red-500">${day}</p>
                        <p class="text-sm uppercase text-gray-400">${month}</p>
                    </div>
                    <div>
                        <h3 class="font-bold text-lg text-white">${event.event}</h3>
                        <p class="text-gray-400">${event.location}</p>
                    </div>
                </div>
            `}).join('');
    }
}

function renderGalleryPage() {
    renderPage('template-galeria');
    const galleryGrid = document.getElementById('gallery-grid');
    if (!galleryGrid) return;

    if(appState.loaders.galleryImages) {
        galleryGrid.innerHTML = getSpinnerHTML();
    } else {
        galleryGrid.innerHTML = appState.galleryImages.map(img => `
            <div class="bg-gray-800 rounded-lg overflow-hidden shadow-lg group cursor-pointer" onclick="openModal('lightbox-modal', '${img.url}')">
                <img src="${img.url.replace('1200x800', '600x400')}" alt="Foto da Galeria" class="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105">
            </div>
        `).join('') || '<p class="text-center text-gray-400 col-span-3">Nenhuma foto na galeria ainda.</p>';
    }
}

function renderShopPage() {
    renderPage('template-loja');
    const productsGrid = document.getElementById('products-grid');
    if(!productsGrid) return;

    if(appState.loaders.products) {
        productsGrid.innerHTML = getSpinnerHTML();
    } else {
        productsGrid.innerHTML = '';
        if (appState.products.length === 0) {
            productsGrid.innerHTML = '<p class="text-center text-gray-400 col-span-4">Nenhum produto na loja.</p>';
            return;
        }
        appState.products.forEach(product => {
            productsGrid.innerHTML += `
                <div class="bg-gray-800 rounded-lg overflow-hidden shadow-lg group flex flex-col">
                    <div class="cursor-pointer" onclick="openProductDetailModal('${product.id}')">
                        <img src="${product.image}" alt="${product.name}" class="w-full h-64 object-cover">
                    </div>
                    <div class="p-6 text-center flex-grow flex flex-col">
                        <h3 class="text-xl font-bold mb-2 flex-grow">${product.name}</h3>
                        <p class="text-2xl font-semibold text-red-500 mb-4">R$ ${product.price.toFixed(2).replace('.', ',')}</p>
                        <button onclick="addToCart('${product.id}')" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Adicionar ao Carrinho</button>
                    </div>
                </div>`;
        });
    }
}

function renderCartPage() {
    renderPage('template-carrinho');
    updateCartDisplay();
}

function renderOrdersPage() {
    renderPage('template-pedidos');
    const container = document.getElementById('orders-container');
    if (!container) return;

    if (appState.loaders.orders) {
        container.innerHTML = getSpinnerHTML();
    } else if (appState.orders.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400">Você ainda não fez nenhum pedido.</p>';
    } else {
        container.innerHTML = appState.orders.map(order => `
            <div class="bg-gray-800 p-6 rounded-lg">
                <div class="flex justify-between items-center mb-4 border-b border-gray-700 pb-4">
                    <div>
                        <p class="font-bold">Pedido #${order.id.slice(0, 8)}</p>
                        <p class="text-sm text-gray-400">Data: ${order.createdAt.toDate().toLocaleDateString('pt-BR')}</p>
                    </div>
                    <p class="font-bold text-lg text-red-500">Total: R$ ${order.totalPrice.toFixed(2).replace('.', ',')}</p>
                </div>
                <div class="space-y-2">
                    ${order.items.map(item => `
                        <div class="flex justify-between items-center">
                            <span>${item.quantity}x ${item.name}</span>
                            <span>R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }
}


async function handleInscriptionSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const newRegistration = {
        name: formData.get('fullName'),
        birthDate: formData.get('birthDate'),
        position: formData.get('position'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        createdAt: new Date(),
    };
    try {
        const collectionRef = collection(db, `artifacts/${appId}/public/data/registrations`);
        await addDoc(collectionRef, newRegistration);
        showToast('Inscrição enviada com sucesso!');
        form.reset();
    } catch (error) {
        console.error("Erro ao enviar inscrição: ", error);
        showToast('Houve um erro ao enviar sua inscrição. Tente novamente.', 'error');
    }
}

function renderInscriptionPage() {
    renderPage('template-inscricao');
    document.getElementById('inscription-form').addEventListener('submit', handleInscriptionSubmit);
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        navigateTo('admin');
    } catch (error) {
        console.error("Erro de login: ", error.code);
        showToast('Email ou senha inválidos.', 'error');
    }
}

function renderLoginPage() {
    renderPage('template-login');
    document.getElementById('login-form').addEventListener('submit', handleLoginSubmit);
}

function renderAdminPage() {
    if (!appState.currentUser) {
        navigateTo('login');
        return;
    }
    renderPage('template-admin');
    const adminNav = document.getElementById('admin-nav');
    adminNav.addEventListener('click', (e) => {
        const link = e.target.closest('.admin-nav-link');
        if (link && link.dataset.section) {
            e.preventDefault();
            renderAdminSection(link.dataset.section);
        }
    });
    document.getElementById('logout-button').addEventListener('click', async () => {
        await signOut(auth);
        navigateTo('home');
    });
    renderAdminSection('dashboard');
}

// ===============================================================================
// LÓGICA DO CARRINHO (Frontend-only)
// ===============================================================================
function addToCart(productId, quantity = 1) {
    const product = appState.products.find(p => p.id === productId);
    if (!product) return;
    const cartItem = cart.find(item => item.id === productId);

    if (cartItem) {
        cartItem.quantity += quantity;
    } else {
        cart.push({ ...product, quantity: quantity });
    }
    updateCartBadge();
    showToast(`${product.name} foi adicionado ao carrinho!`);
}

function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (badge) {
        badge.textContent = totalItems;
        badge.style.display = totalItems > 0 ? 'flex' : 'none';
    }
}

function updateCartDisplay() {
    const container = document.getElementById('cart-items-container');
    const summary = document.getElementById('cart-summary');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400">Seu carrinho está vazio.</p>';
        summary.innerHTML = '';
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="flex items-center justify-between bg-gray-800 p-4 rounded-lg mb-4 flex-wrap">
            <div class="flex items-center mb-4 sm:mb-0">
                <img src="${item.image}" alt="${item.name}" class="w-20 h-20 object-cover rounded-md mr-4">
                <div>
                    <h3 class="font-bold text-lg">${item.name}</h3>
                    <p class="text-red-500">R$ ${item.price.toFixed(2).replace('.', ',')}</p>
                </div>
            </div>
            <div class="flex items-center gap-4 w-full sm:w-auto justify-end">
                <div class="flex items-center border border-gray-600 rounded">
                    <button onclick="updateCartQuantity('${item.id}', -1)" class="px-3 py-1">-</button>
                    <span class="px-4">${item.quantity}</span>
                    <button onclick="updateCartQuantity('${item.id}', 1)" class="px-3 py-1">+</button>
                </div>
                <p class="font-bold w-24 text-right">R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
                <button onclick="removeFromCart('${item.id}')" class="text-gray-400 hover:text-red-500 text-2xl">&times;</button>
            </div>
        </div>`).join('');

    const totalPrice = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    summary.innerHTML = `
        <h2 class="text-2xl font-bold">Total: <span class="text-red-600">R$ ${totalPrice.toFixed(2).replace('.', ',')}</span></h2>
        <button onclick="checkout()" class="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg">Finalizar Compra</button>`;
}

function updateCartQuantity(productId, change) {
    const item = cart.find(i => i.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            updateCartDisplay();
            updateCartBadge();
        }
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartDisplay();
    updateCartBadge();
}

// ===============================================================================
// ADMIN MODALS E LÓGICA DE DADOS (Firestore)
// ===============================================================================
const adminContentArea = () => document.getElementById('admin-content-area');

function renderAdminSection(section) {
    document.querySelectorAll('.admin-nav-link').forEach(link => link.classList.remove('bg-red-600', 'text-white'));
    document.querySelector(`.admin-nav-link[data-section="${section}"]`).classList.add('bg-red-600', 'text-white');
    const renderers = {
        'dashboard': renderAdminDashboard, 'paginas': renderAdminPages, 'noticias': renderAdminNews,
        'calendario': renderAdminCalendar, 'galeria': renderAdminGallery, 'loja': renderAdminShop,
        'inscricoes': renderAdminRegistrations,
    };
    if(renderers[section]) renderers[section]();
}

function renderAdminDashboard() {
    const contentArea = adminContentArea();
    if (contentArea) contentArea.innerHTML = `
        <h1 class="text-3xl font-bold mb-8">Dashboard</h1>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 class="text-gray-400 text-sm font-bold">EVENTOS AGENDADOS</h3><p class="text-3xl font-black text-red-600">${appState.calendarEvents.length}</p></div>
            <div class="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 class="text-gray-400 text-sm font-bold">NOTÍCIAS PUBLICADAS</h3><p class="text-3xl font-black">${appState.news.length}</p></div>
            <div class="bg-gray-800 p-6 rounded-lg shadow-lg"><h3 class="text-gray-400 text-sm font-bold">NOVAS INSCRIÇÕES</h3><p class="text-3xl font-black">${appState.registrations.length}</p></div>
        </div>`;
}

function renderAdminPages() {
    const contentArea = adminContentArea();
    if(!contentArea) return;
    contentArea.innerHTML = `
        <h2 class="text-2xl font-bold mb-8">Gerenciar Páginas</h2>
        <div class="space-y-8">
            <div class="bg-gray-800 p-6 rounded-lg">
                <h3 class="text-xl font-bold mb-4">Página Home</h3>
                <form id="home-page-form">
                    <div class="mb-4"><label class="block mb-2">Título Principal</label><textarea name="headline" rows="2" class="w-full bg-gray-700 p-2 rounded">${(appState.pageContent.home.headline || '').replace(/<br>/g, "\n")}</textarea></div>
                    <div class="mb-4"><label class="block mb-2">Subtítulo</label><textarea name="subheadline" rows="3" class="w-full bg-gray-700 p-2 rounded">${appState.pageContent.home.subheadline || ''}</textarea></div>
                    <div class="text-right"><button type="submit" class="bg-red-600 hover:bg-red-700 py-2 px-4 rounded">Salvar Home</button></div>
                </form>
            </div>
            <div class="bg-gray-800 p-6 rounded-lg">
                <h3 class="text-xl font-bold mb-4">Página Sobre</h3>
                <form id="about-page-form">
                    <div class="mb-4"><label class="block mb-2">Texto de Missão e Valores</label><textarea name="mission" rows="6" class="w-full bg-gray-700 p-2 rounded">${(appState.pageContent.about.mission || '').replace(/<p class="mb-4">/g, "").replace(/<\/p>/g, "\n\n").trim()}</textarea></div>
                    <div class="text-right"><button type="submit" class="bg-red-600 hover:bg-red-700 py-2 px-4 rounded">Salvar Sobre</button></div>
                </form>
            </div>
        </div>`;
    document.getElementById('home-page-form').addEventListener('submit', saveHomePageContent);
    document.getElementById('about-page-form').addEventListener('submit', saveAboutPageContent);
}

function renderAdminNews() {
    const contentArea = adminContentArea();
    if (contentArea) contentArea.innerHTML = `
        <div class="flex justify-between items-center mb-4"><h2 class="text-2xl font-bold">Gerenciar Notícias</h2><button onclick="openNewsModal()" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Nova Postagem</button></div>
        <div class="bg-gray-800 rounded-lg overflow-x-auto"><table class="w-full text-left min-w-max">
            <thead class="bg-gray-700"><tr><th class="p-4">Título</th><th class="p-4">Data</th><th class="p-4">Ações</th></tr></thead>
            <tbody>
                ${appState.news.map(article => `<tr class="border-b border-gray-700">
                    <td class="p-4">${article.title}</td><td class="p-4">${article.date}</td>
                    <td class="p-4 whitespace-nowrap"><button onclick="openNewsModal('${article.id}')" class="text-green-400 hover:text-green-300 mr-4">Editar</button><button onclick="deleteNews('${article.id}')" class="text-red-500 hover:text-red-400">Excluir</button></td>
                </tr>`).join('') || '<tr><td colspan="3" class="p-4 text-center text-gray-400">Nenhuma notícia encontrada.</td></tr>'}
            </tbody></table></div>`;
}

function renderAdminCalendar() {
    const contentArea = adminContentArea();
    if (contentArea) contentArea.innerHTML = `
        <div class="flex justify-between items-center mb-4"><h2 class="text-2xl font-bold">Gerenciar Calendário</h2><button onclick="openCalendarEventModal()" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Novo Evento</button></div>
        <div class="bg-gray-800 rounded-lg overflow-x-auto"><table class="w-full text-left min-w-max">
            <thead class="bg-gray-700"><tr><th class="p-4">Data</th><th class="p-4">Evento</th><th class="p-4">Local</th><th class="p-4">Ações</th></tr></thead>
            <tbody>
                ${[...appState.calendarEvents].sort((a,b) => new Date(a.date) - new Date(b.date)).map(event => `<tr class="border-b border-gray-700">
                    <td class="p-4">${new Date(event.date + 'T00:00:00-03:00').toLocaleDateString('pt-BR')}</td><td class="p-4">${event.event}</td><td class="p-4">${event.location}</td>
                    <td class="p-4 whitespace-nowrap"><button onclick="openCalendarEventModal('${event.id}')" class="text-green-400 hover:text-green-300 mr-4">Editar</button><button onclick="deleteCalendarEvent('${event.id}')" class="text-red-500 hover:text-red-400">Excluir</button></td>
                </tr>`).join('') || '<tr><td colspan="4" class="p-4 text-center text-gray-400">Nenhum evento encontrado.</td></tr>'}
            </tbody></table></div>`;
}

function renderAdminGallery() {
    const contentArea = adminContentArea();
    if (contentArea) contentArea.innerHTML = `
        <h2 class="text-2xl font-bold mb-4">Gerenciar Galeria</h2>
        <form id="gallery-form" class="mb-8 bg-gray-800 p-4 rounded-lg flex gap-4 items-end"><div class="flex-grow">
            <label for="imageUrl" class="block text-sm font-semibold mb-2 text-gray-300">URL da Nova Imagem</label>
            <input type="url" id="imageUrl" name="imageUrl" class="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-4" placeholder="https://exemplo.com/imagem.jpg" required>
            <small class="text-gray-400 mt-1 block">Em um site real, aqui seria um botão de upload de arquivo.</small></div>
            <button type="submit" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Adicionar Foto</button></form>
        <div class="bg-gray-800 rounded-lg overflow-x-auto"><table class="w-full text-left min-w-max">
            <thead class="bg-gray-700"><tr><th class="p-4">Imagem</th><th class="p-4">Ações</th></tr></thead>
            <tbody>
                ${appState.galleryImages.map(img => `<tr class="border-b border-gray-700">
                        <td class="p-4"><img src="${img.url.replace('1200x800', '600x400')}" alt="Imagem da Galeria" class="h-16 w-24 object-cover rounded"></td>
                    <td class="p-4"><button onclick="deleteGalleryImage('${img.id}')" class="text-red-500 hover:text-red-400">Excluir</button></td>
                </tr>`).join('') || '<tr><td colspan="2" class="p-4 text-center text-gray-400">Nenhuma foto na galeria.</td></tr>'}
            </tbody></table></div>`;
    document.getElementById('gallery-form').addEventListener('submit', addGalleryImage);
}

function renderAdminShop() {
    const contentArea = adminContentArea();
    if (contentArea) contentArea.innerHTML = `
        <div class="flex justify-between items-center mb-4"><h2 class="text-2xl font-bold">Gerenciar Loja</h2><button onclick="openProductModal()" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Novo Produto</button></div>
        <div class="bg-gray-800 rounded-lg overflow-x-auto"><table class="w-full text-left min-w-max">
            <thead class="bg-gray-700"><tr><th class="p-4">Produto</th><th class="p-4">Preço</th><th class="p-4">Ações</th></tr></thead>
            <tbody>
                ${appState.products.map(product => `<tr class="border-b border-gray-700">
                        <td class="p-4 flex items-center"><img src="${product.image}" alt="${product.name}" class="h-12 w-12 object-cover rounded mr-4"> ${product.name}</td>
                    <td class="p-4">R$ ${product.price.toFixed(2).replace('.', ',')}</td>
                    <td class="p-4 whitespace-nowrap"><button onclick="openProductModal('${product.id}')" class="text-green-400 hover:text-green-300 mr-4">Editar</button><button onclick="deleteProduct('${product.id}')" class="text-red-500 hover:text-red-400">Excluir</button></td>
                </tr>`).join('') || '<tr><td colspan="3" class="p-4 text-center text-gray-400">Nenhum produto encontrado.</td></tr>'}
            </tbody></table></div>`;
}

function renderAdminRegistrations() {
    const contentArea = adminContentArea();
    if (contentArea) contentArea.innerHTML = `
        <h2 class="text-2xl font-bold mb-4">Inscrições Recebidas</h2>
        <div class="bg-gray-800 rounded-lg overflow-x-auto"><table class="w-full text-left min-w-max">
            <thead class="bg-gray-700"><tr><th class="p-4">Nome</th><th class="p-4">Nascimento</th><th class="p-4">Posição</th><th class="p-4">Contato</th></tr></thead>
            <tbody>
                ${[...appState.registrations].sort((a,b) => b.createdAt.toDate() - a.createdAt.toDate()).map(reg => `<tr class="border-b border-gray-700">
                    <td class="p-4">${reg.name}</td><td class="p-4">${reg.birthDate}</td>
                    <td class="p-4">${reg.position}</td><td class="p-4">${reg.email}</td>
                </tr>`).join('') || '<tr><td colspan="4" class="p-4 text-center text-gray-400">Nenhuma inscrição encontrada.</td></tr>'}
            </tbody></table></div>`;
}

function openProductDetailModal(id) {
    const product = appState.products.find(p => p.id === id);
    if (!product) return;

    // --- Static Reviews Section ---
    const reviewsHTML = `
        <div class="mt-10 pt-6 border-t border-gray-700">
            <h3 class="text-xl font-bold mb-4">Avaliações de Clientes (Simulação)</h3>
            <div class="space-y-4">
                <!-- Review 1 -->
                <div class="bg-gray-700/50 p-4 rounded-lg">
                    <div class="flex items-center mb-2">
                        <div class="text-yellow-400">
                            <span>&#9733;</span><span>&#9733;</span><span>&#9733;</span><span>&#9733;</span><span>&#9734;</span>
                        </div>
                        <p class="ml-2 text-sm font-bold">João S.</p>
                    </div>
                    <p class="text-gray-300">Ótima qualidade, superou minhas expectativas!</p>
                </div>
                <!-- Review 2 -->
                <div class="bg-gray-700/50 p-4 rounded-lg">
                    <div class="flex items-center mb-2">
                        <div class="text-yellow-400">
                            <span>&#9733;</span><span>&#9733;</span><span>&#9733;</span><span>&#9733;</span><span>&#9733;</span>
                        </div>
                        <p class="ml-2 text-sm font-bold">Maria P.</p>
                    </div>
                    <p class="text-gray-300">Entrega rápida e produto excelente. Recomendo!</p>
                </div>
            </div>
        </div>
    `;

    // --- Related Products Section ---
    const relatedProducts = appState.products
        .filter(p => p.id !== id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

    let relatedProductsHTML = '';
    if (relatedProducts.length > 0) {
        relatedProductsHTML = `
            <div class="mt-10 pt-6 border-t border-gray-700">
                <h3 class="text-xl font-bold mb-4">Você também pode gostar</h3>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    ${relatedProducts.map(p => `
                        <div class="bg-gray-700/50 p-2 rounded-lg text-center cursor-pointer hover:bg-gray-700" onclick="openProductDetailModal('${p.id}')">
                            <img src="${p.image}" alt="${p.name}" class="w-full h-32 object-cover rounded-md">
                            <h4 class="text-sm font-semibold mt-2 truncate">${p.name}</h4>
                             <p class="text-sm text-red-500">R$ ${p.price.toFixed(2).replace('.', ',')}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    const modalContent = `
        <button onclick="closeModal('generic-modal')" class="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl z-10">&times;</button>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div><img src="${product.image}" alt="${product.name}" class="w-full h-auto object-cover rounded-lg"></div>
            <div>
                <h2 class="text-3xl font-bold mb-2">${product.name}</h2>
                <p class="text-3xl font-semibold text-red-500 mb-4">R$ ${product.price.toFixed(2).replace('.', ',')}</p>
                <p class="text-gray-300 mb-6">${product.description}</p>
                <button onclick="addToCart('${product.id}'); closeModal('generic-modal');" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300">Adicionar ao Carrinho</button>
            </div>
        </div>
        ${reviewsHTML}
        ${relatedProductsHTML}
    `;

    openModal('generic-modal', null, modalContent);
}

function openNewsModal(id = null) {
    const article = id ? appState.news.find(a => a.id === id) : null;
    openModal('generic-modal', null, `
        <h2 class="text-2xl font-bold mb-6">${id ? 'Editar' : 'Nova'} Notícia</h2><form id="news-form"><input type="hidden" name="id" value="${id || ''}">
            <div class="mb-4"><label class="block mb-2">Título</label><input type="text" name="title" class="w-full bg-gray-700 p-2 rounded" value="${article?.title || ''}" required></div>
            <div class="mb-4"><label class="block mb-2">Conteúdo</label><textarea name="content" rows="4" class="w-full bg-gray-700 p-2 rounded" required>${article?.content || ''}</textarea></div>
            <div class="mb-6"><label class="block mb-2">URL da Imagem</label><input type="text" name="image" class="w-full bg-gray-700 p-2 rounded" value="${article?.image || 'https://source.unsplash.com/600x400/?volleyball,action'}" required>
            <small class="text-gray-400 mt-1 block">Em um site real, aqui seria um botão de upload de arquivo.</small></div>
            <div class="flex justify-end gap-4"><button type="button" onclick="closeModal('generic-modal')" class="bg-gray-600 hover:bg-gray-700 py-2 px-4 rounded">Cancelar</button><button type="submit" class="bg-red-600 hover:bg-red-700 py-2 px-4 rounded">Salvar</button></div>
        </form>`);
    document.getElementById('news-form').addEventListener('submit', saveNews);
}

function openProductModal(id = null) {
    const product = id ? appState.products.find(p => p.id === id) : null;
    openModal('generic-modal', null, `
         <h2 class="text-2xl font-bold mb-6">${id ? 'Editar' : 'Novo'} Produto</h2><form id="product-form"><input type="hidden" name="id" value="${id || ''}">
            <div class="mb-4"><label class="block mb-2">Nome do Produto</label><input type="text" name="name" class="w-full bg-gray-700 p-2 rounded" value="${product?.name || ''}" required></div>
            <div class="mb-4"><label class="block mb-2">Preço (ex: 89.90)</label><input type="number" step="0.01" name="price" class="w-full bg-gray-700 p-2 rounded" value="${product?.price || ''}" required></div>
            <div class="mb-4"><label class="block mb-2">Descrição</label><textarea name="description" rows="4" class="w-full bg-gray-700 p-2 rounded" required>${product?.description || ''}</textarea></div>
            <div class="mb-6"><label class="block mb-2">URL da Imagem</label><input type="text" name="image" class="w-full bg-gray-700 p-2 rounded" value="${product?.image || 'https://source.unsplash.com/600x600/?volleyball,product'}" required>
            <small class="text-gray-400 mt-1 block">Em um site real, aqui seria um botão de upload de arquivo.</small></div>
            <div class="flex justify-end gap-4"><button type="button" onclick="closeModal('generic-modal')" class="bg-gray-600 hover:bg-gray-700 py-2 px-4 rounded">Cancelar</button><button type="submit" class="bg-red-600 hover:bg-red-700 py-2 px-4 rounded">Salvar</button></div>
         </form>`);
    document.getElementById('product-form').addEventListener('submit', saveProduct);
}

function openCalendarEventModal(id = null) {
    const event = id ? appState.calendarEvents.find(e => e.id === id) : null;
    openModal('generic-modal', null, `
        <h2 class="text-2xl font-bold mb-6">${id ? 'Editar' : 'Novo'} Evento</h2><form id="calendar-event-form"><input type="hidden" name="id" value="${id || ''}">
            <div class="mb-4"><label class="block mb-2">Data</label><input type="date" name="date" class="w-full bg-gray-700 p-2 rounded" value="${event?.date || ''}" required></div>
            <div class="mb-4"><label class="block mb-2">Nome do Evento</label><input type="text" name="event" class="w-full bg-gray-700 p-2 rounded" value="${event?.event || ''}" required></div>
            <div class="mb-6"><label class="block mb-2">Local</label><input type="text" name="location" class="w-full bg-gray-700 p-2 rounded" value="${event?.location || ''}" required></div>
            <div class="flex justify-end gap-4"><button type="button" onclick="closeModal('generic-modal')" class="bg-gray-600 hover:bg-gray-700 py-2 px-4 rounded">Cancelar</button><button type="submit" class="bg-red-600 hover:bg-red-700 py-2 px-4 rounded">Salvar</button></div>
        </form>`);
    document.getElementById('calendar-event-form').addEventListener('submit', saveCalendarEvent);
}

function openForgotPasswordModal(e) {
    e.preventDefault();
    openModal('generic-modal', null, `
        <h2 class="text-2xl font-bold mb-6">Redefinir Senha</h2><form id="forgot-password-form">
            <p class="text-gray-400 mb-4">Digite seu e-mail para enviarmos um link de redefinição de senha.</p>
            <div class="mb-6"><label class="block mb-2">E-mail</label><input type="email" name="email" class="w-full bg-gray-700 p-2 rounded" placeholder="seuemail@exemplo.com" required></div>
            <div class="flex justify-end gap-4"><button type="button" onclick="closeModal('generic-modal')" class="bg-gray-600 hover:bg-gray-700 py-2 px-4 rounded">Cancelar</button><button type="submit" class="bg-red-600 hover:bg-red-700 py-2 px-4 rounded">Enviar Link</button></div>
        </form>`);
    document.getElementById('forgot-password-form').addEventListener('submit', handleForgotPassword);
}

// ===============================================================================
// LÓGICA DE ESCRITA NO FIRESTORE
// ===============================================================================
const getCollectionRef = (name) => collection(db, `artifacts/${appId}/public/data/${name}`);
const getDocRef = (col, id) => doc(db, `artifacts/${appId}/public/data/${col}`, id);

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = e.target.email.value;
    try {
        await sendPasswordResetEmail(auth, email);
        showToast('Um link de redefinição de senha foi enviado para o seu e-mail.', 'info');
    } catch (error) {
        console.error("Erro ao enviar email de redefinição: ", error);
        showToast('Houve um erro. Verifique o e-mail digitado.', 'error');
    } finally {
        closeModal('generic-modal');
    }
}

async function saveHomePageContent(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const content = {
        headline: formData.get('headline').replace(/\n/g, "<br>"),
        subheadline: formData.get('subheadline'),
    };
    await setDoc(doc(db, `artifacts/${appId}/public/data/pages/home`), content);
    showToast('Página Home atualizada com sucesso!');
}

async function saveAboutPageContent(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const missionText = formData.get('mission');
    const content = {
        mission: missionText.split('\n\n').map(p => `<p class="${p === missionText.split('\n\n').slice(-1)[0] ? '' : 'mb-4'}">${p}</p>`).join('')
    };
    await setDoc(doc(db, `artifacts/${appId}/public/data/pages/about`), content);
    showToast('Página Sobre atualizada com sucesso!');
}

async function saveNews(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = formData.get('id');
    const articleData = {
        title: formData.get('title'), content: formData.get('content'), image: formData.get('image'),
        date: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    };
    if (id) await updateDoc(getDocRef('news', id), articleData);
    else await addDoc(getCollectionRef('news'), articleData);
    closeModal('generic-modal');
}

async function deleteNews(id) {
    if (confirm('Tem certeza?')) await deleteDoc(getDocRef('news', id));
}

async function saveCalendarEvent(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = formData.get('id');
    const eventData = { date: formData.get('date'), event: formData.get('event'), location: formData.get('location') };
    if (id) await updateDoc(getDocRef('calendarEvents', id), eventData);
    else await addDoc(getCollectionRef('calendarEvents'), eventData);
    closeModal('generic-modal');
}

async function deleteCalendarEvent(id) {
     if (confirm('Tem certeza?')) await deleteDoc(getDocRef('calendarEvents', id));
}

async function addGalleryImage(e) {
    e.preventDefault();
    const imageUrl = e.target.imageUrl.value;
    if (imageUrl) {
        await addDoc(getCollectionRef('galleryImages'), { url: imageUrl, createdAt: new Date() });
        e.target.reset();
    }
}

async function deleteGalleryImage(id) {
    if (confirm('Tem certeza?')) await deleteDoc(getDocRef('galleryImages', id));
}

async function saveProduct(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = formData.get('id');
    const productData = {
        name: formData.get('name'), price: parseFloat(formData.get('price')),
        image: formData.get('image'), description: formData.get('description'),
    };
    if (id) await updateDoc(getDocRef('products', id), productData);
    else await addDoc(getCollectionRef('products'), productData);
    closeModal('generic-modal');
}

async function deleteProduct(id) {
    if (confirm('Tem certeza?')) await deleteDoc(getDocRef('products', id));
}


// ===============================================================================
// ROTEAMENTO E NAVEGAÇÃO
// ===============================================================================
const pageRenderers = {
    'home': renderHomePage, 'sobre': renderAboutPage, 'noticias': renderNewsPage,
    'calendario': renderCalendarPage, 'galeria': renderGalleryPage, 'loja': renderShopPage,
    'carrinho': renderCartPage, 'pedidos': renderOrdersPage, 'inscricao': renderInscriptionPage,
    'login': renderLoginPage, 'admin': renderAdminPage
};

function navigateTo(pageId) {
    const header = document.querySelector('header');
    const footer = document.querySelector('footer');
    const isAdminPage = pageId.startsWith('admin');
    header.style.display = isAdminPage ? 'none' : '';
    footer.style.display = isAdminPage ? 'none' : '';
    const basePageId = isAdminPage ? 'admin' : pageId;
    const renderFunction = pageRenderers[basePageId];
    if (renderFunction) {
        appRoot.style.opacity = 0;
        setTimeout(() => {
            renderFunction(); appRoot.style.opacity = 1;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (window.location.hash !== `#${pageId}`) history.pushState({pageId}, '', `#${pageId}`);
            updateActiveLink(pageId);
        }, 200);
    }
}

function updateActiveLink(activePageId) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${activePageId}`);
    });
}

function closeMobileMenu() {
    mobileMenu.classList.add('hidden');
}

mobileMenuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));

document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (link && !link.closest('#admin-nav')) {
        e.preventDefault();
        const pageId = link.getAttribute('href').substring(1);
        if (link.closest('#mobile-menu')) closeMobileMenu();
        if (pageId) navigateTo(pageId);
    }
});

// ===============================================================================
// INICIALIZAÇÃO E EVENTOS GLOBAIS
// ===============================================================================
function openModal(modalId, imageSrc = null, contentHTML = null) {
    const modal = document.getElementById(modalId);
    if (modal) {
        if (modalId === 'lightbox-modal' && imageSrc) {
            document.getElementById('lightbox-image').src = imageSrc;
        }
        if (modalId === 'generic-modal' && contentHTML) {
            document.getElementById('generic-modal-content').innerHTML = contentHTML;
        }
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

window.openModal = openModal; // Expor globalmente para onclicks

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
}
window.closeModal = closeModal; // Expor globalmente para onclicks

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeModal('lightbox-modal');
        closeModal('generic-modal');
    }
});

let ordersUnsubscribe = null;
function setupRealtimeListeners() {
    // Unsubscribe from previous listeners if they exist
    if (ordersUnsubscribe) ordersUnsubscribe();

    const collectionsToLoad = {
        pageContent: ['home', 'about'], // Special handling for documents
        calendarEvents: 'calendarEvents',
        products: 'products',
        news: 'news',
        galleryImages: 'galleryImages',
        registrations: 'registrations', // No loader for this, admin only
    };

    Object.keys(collectionsToLoad).forEach(loaderKey => {
        if(loaderKey === 'pageContent') {
            onSnapshot(doc(db, `artifacts/${appId}/public/data/pages/home`), doc => {
                appState.pageContent.home = doc.data() || {};
                appState.loaders.pageContent = false;
                const currentPage = window.location.hash.substring(1) || 'home';
                if(currentPage === 'home') renderHomePage();
            });
            onSnapshot(doc(db, `artifacts/${appId}/public/data/pages/about`), doc => {
                appState.pageContent.about = doc.data() || {};
                const currentPage = window.location.hash.substring(1) || 'home';
                if(currentPage === 'sobre') renderAboutPage();
            });
        } else {
            const collectionName = collectionsToLoad[loaderKey];
            onSnapshot(getCollectionRef(collectionName), snapshot => {
                appState[loaderKey] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if(appState.loaders[loaderKey] !== undefined) {
                    appState.loaders[loaderKey] = false;
                }

                const currentPage = window.location.hash.substring(1) || 'home';
                const pageDependencies = {
                    home: ['news'], sobre: [], noticias: ['news'], calendario: ['calendarEvents'],
                    galeria: ['galleryImages'], loja: ['products'], admin: ['news', 'calendarEvents', 'galleryImages', 'products', 'registrations'],
                    pedidos: ['orders']
                };

                if (pageDependencies[currentPage]?.includes(loaderKey) || (currentPage.startsWith('admin') && pageDependencies.admin.includes(loaderKey))) {
                     if (pageRenderers[currentPage] && appRoot.innerHTML) {
                        pageRenderers[currentPage]();
                    }
                }
            }, error => console.error(`Erro no listener da coleção ${collectionName}: `, error));
        }
    });

    if (appState.currentUser) {
        const q = query(getCollectionRef("orders"), where("userId", "==", appState.currentUser.uid), orderBy("createdAt", "desc"));
        ordersUnsubscribe = onSnapshot(q, (querySnapshot) => {
            appState.orders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            appState.loaders.orders = false;
            if (window.location.hash === '#pedidos') {
                renderOrdersPage();
            }
        });
    } else {
        appState.orders = [];
        appState.loaders.orders = false;
    }
}

function handleInitialPageLoad() {
    updateCartBadge();
    let listenersAttached = false;
    onAuthStateChanged(auth, user => {
        appState.currentUser = user;
        document.querySelectorAll('.requires-auth').forEach(el => {
            el.style.display = user ? '' : 'none';
        });

        // Setup listeners only once, but re-setup order listener on auth change
        if (!listenersAttached) {
            setupRealtimeListeners();
            listenersAttached = true;
        } else {
             // Re-setup just the order listener as it depends on the user
            if (ordersUnsubscribe) ordersUnsubscribe();
            if (user) {
                const q = query(getCollectionRef("orders"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
                ordersUnsubscribe = onSnapshot(q, (querySnapshot) => {
                    appState.orders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    appState.loaders.orders = false;
                    if (window.location.hash === '#pedidos') {
                        renderOrdersPage();
                    }
                });
            } else {
                appState.orders = [];
                appState.loaders.orders = false;
            }
        }

        const initialPage = window.location.hash.substring(1) || 'home';
        if (user && (initialPage === 'login' || !initialPage)) {
            navigateTo('admin');
        } else if (!user && (initialPage.startsWith('admin') || initialPage === 'pedidos')) {
            navigateTo('login');
        } else {
            navigateTo(initialPage);
        }
    });
}

document.addEventListener('DOMContentLoaded', handleInitialPageLoad);

window.addEventListener('popstate', (event) => {
    const pageId = event.state?.pageId || window.location.hash.substring(1) || 'home';
    navigateTo(pageId);
});

// Expor funções globais necessárias para os onclicks
window.openProductDetailModal = openProductDetailModal;
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.openForgotPasswordModal = openForgotPasswordModal;
window.openNewsModal = openNewsModal;
window.deleteNews = deleteNews;
window.openProductModal = openProductModal;
window.deleteProduct = deleteProduct;
window.openCalendarEventModal = openCalendarEventModal;
window.deleteCalendarEvent = deleteCalendarEvent;
window.deleteGalleryImage = deleteGalleryImage;
window.checkout = checkout;
