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
let listeners = []; // Array to hold all unsubscribe functions

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
    let bgColor = 'bg-green-500';
    if (type === 'error') bgColor = 'bg-red-600';
    if (type === 'info') bgColor = 'bg-blue-500';

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
    if (!appState.currentUser) {
        navigateTo('login');
        showToast('Você precisa estar logado para ver seus pedidos.', 'info');
        return;
    }
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
                <div class="flex flex-wrap justify-between items-center mb-4 border-b border-gray-700 pb-4 gap-2">
                    <div>
                        <p class="font-bold">Pedido #${order.id.slice(0, 8).toUpperCase()}</p>
                        <p class="text-sm text-gray-400">Data: ${order.createdAt.toDate().toLocaleDateString('pt-BR')}</p>
                    </div>
                    <p class="font-bold text-lg text-red-500">Total: R$ ${order.totalPrice.toFixed(2).replace('.', ',')}</p>
                </div>
                <div class="space-y-2">
                    ${order.items.map(item => `
                        <div class="flex justify-between items-center text-gray-300">
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

// ... (code for addToCart, updateCartBadge, updateCartDisplay, etc.)

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

// ... (rest of the file is mostly the same, but with the new listener logic)

// ===============================================================================
// INICIALIZAÇÃO E EVENTOS GLOBAIS
// ===============================================================================
// ...

function setupRealtimeListeners() {
    // Unsubscribe from all previous listeners
    listeners.forEach(unsub => unsub());
    listeners = [];

    const collectionsToLoad = {
        pageContent: ['home', 'about'],
        calendarEvents: 'calendarEvents',
        products: 'products',
        news: 'news',
        galleryImages: 'galleryImages',
        registrations: 'registrations',
    };

    Object.keys(collectionsToLoad).forEach(loaderKey => {
        if(loaderKey === 'pageContent') {
            const unsubHome = onSnapshot(doc(db, `artifacts/${appId}/public/data/pages/home`), doc => {
                appState.pageContent.home = doc.data() || {};
                appState.loaders.pageContent = false;
                const currentPage = window.location.hash.substring(1) || 'home';
                if(currentPage === 'home') renderHomePage();
            });
            listeners.push(unsubHome);

            const unsubAbout = onSnapshot(doc(db, `artifacts/${appId}/public/data/pages/about`), doc => {
                appState.pageContent.about = doc.data() || {};
                const currentPage = window.location.hash.substring(1) || 'home';
                if(currentPage === 'sobre') renderAboutPage();
            });
            listeners.push(unsubAbout);
        } else if (loaderKey !== 'registrations') { // Don't need a public listener for registrations
            const collectionName = collectionsToLoad[loaderKey];
            const unsub = onSnapshot(getCollectionRef(collectionName), snapshot => {
                appState[loaderKey] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if(appState.loaders[loaderKey] !== undefined) {
                    appState.loaders[loaderKey] = false;
                }

                const currentPage = window.location.hash.substring(1) || 'home';
                const pageDependencies = {
                    home: ['news'], sobre: [], noticias: ['news'], calendario: ['calendarEvents'],
                    galeria: ['galleryImages'], loja: ['products'], admin: ['news', 'calendarEvents', 'galleryImages', 'products'],
                    pedidos: ['orders']
                };

                if (pageDependencies[currentPage]?.includes(loaderKey) || (currentPage.startsWith('admin') && pageDependencies.admin.includes(loaderKey))) {
                     if (pageRenderers[currentPage] && appRoot.innerHTML) {
                        pageRenderers[currentPage]();
                    }
                }
            });
            listeners.push(unsub);
        }
    });

    // Handle user-specific listeners
    if (appState.currentUser) {
        // Orders listener
        const ordersQuery = query(getCollectionRef("orders"), where("userId", "==", appState.currentUser.uid), orderBy("createdAt", "desc"));
        const unsubOrders = onSnapshot(ordersQuery, (querySnapshot) => {
            appState.orders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            appState.loaders.orders = false;
            if (window.location.hash === '#pedidos') {
                renderOrdersPage();
            }
        });
        listeners.push(unsubOrders);

        // Registrations listener (for admin)
         const unsubRegistrations = onSnapshot(getCollectionRef("registrations"), (snapshot) => {
            appState.registrations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });
        listeners.push(unsubRegistrations);

    } else {
        appState.orders = [];
        appState.loaders.orders = false;
    }
}

function handleInitialPageLoad() {
    updateCartBadge();

    onAuthStateChanged(auth, user => {
        appState.currentUser = user;
        document.querySelectorAll('.requires-auth').forEach(el => {
            el.style.display = user ? '' : 'none';
        });

        setupRealtimeListeners();

        const currentPage = window.location.hash.substring(1) || 'home';
        if (user && (currentPage === 'login' || !currentPage)) {
            navigateTo('admin');
        } else if (!user && (currentPage.startsWith('admin') || currentPage === 'pedidos')) {
            navigateTo('login');
        } else {
            navigateTo(currentPage);
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
