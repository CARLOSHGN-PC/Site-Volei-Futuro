// ===============================================================================
// IMPORTS E INICIALIZAÇÃO DO FIREBASE
// ===============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    updatePassword,
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
    orderBy,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCDN1iJm_O3bms8M-RltpMSRttlED9YAJ8",
    authDomain: "volei-futuro.firebaseapp.com",
    projectId: "volei-futuro",
    storageBucket: "volei-futuro.appspot.com",
    messagingSenderId: "145355555073",
    appId: "1:145355555073:web:12e32dce4fb081b1ca5b00",
    measurementId: "G-Y1DNMKXEM2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app, 'southamerica-east1'); // São Paulo
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
    shipping_options: [],
    currentUser: null,
};

let cart = [];

// ===============================================================================
// ELEMENTOS GLOBAIS
// ===============================================================================
const appRoot = document.getElementById('app-root');
const mobileMenuButton = document.getElementById('mobile-menu-button');
const mobileMenu = document.getElementById('mobile-menu');

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

async function handleProfileUpdate(e) {
    e.preventDefault();
    const newName = e.target.accountName.value;
    if (!newName) {
        showCustomAlert('Erro', 'O nome não pode estar em branco.');
        return;
    }

    try {
        await updateProfile(auth.currentUser, { displayName: newName });
        handleUserAuthState(auth.currentUser); // Update the header
        showCustomAlert('Sucesso!', 'Seu nome foi atualizado.');
    } catch (error) {
        console.error("Error updating profile: ", error);
        showCustomAlert('Erro', 'Não foi possível atualizar seu nome.');
    }
}

async function handlePasswordUpdate(e) {
    e.preventDefault();
    const newPassword = e.target.newPassword.value;
    if (newPassword.length < 6) {
        showCustomAlert('Erro', 'A nova senha deve ter pelo menos 6 caracteres.');
        return;
    }

    try {
        await updatePassword(auth.currentUser, newPassword);
        e.target.reset();
        showCustomAlert('Sucesso!', 'Sua senha foi alterada.');
    } catch (error) {
        console.error("Error updating password: ", error);
        showCustomAlert('Erro', 'Ocorreu um erro ao alterar sua senha. Pode ser necessário fazer login novamente antes de tentar de novo.');
    }
}

function renderHomePage() {
    renderPage('template-home');
    document.getElementById('home-headline').innerHTML = appState.pageContent.home.headline || "Carregando...";
    document.getElementById('home-subheadline').innerHTML = appState.pageContent.home.subheadline || "";

    const videoElement = document.getElementById('hero-video-element');
    if (videoElement && appState.pageContent.home.backgroundVideoUrl) {
        const sourceElement = videoElement.querySelector('source');
        if (sourceElement) {
            sourceElement.src = appState.pageContent.home.backgroundVideoUrl;
            videoElement.load(); // Reload the video with the new source
        }
    }

    const newsGrid = document.getElementById('home-news-grid');
    if (!newsGrid) return;
    newsGrid.innerHTML = '';
    appState.news.slice(0, 3).forEach(article => {
        newsGrid.innerHTML += `
            <div class="bg-gray-900 rounded-lg overflow-hidden shadow-lg transform hover:-translate-y-2 transition duration-300">
                <img src="${article.image}" class="w-full h-48 object-cover">
                <div class="p-6">
                    <span class="text-sm text-red-500">${article.date}</span>
                    <h3 class="text-xl font-bold mt-2 mb-3">${article.title}</h3>
                    <p class="text-gray-400 text-sm mb-4">${article.content}</p>
                    <a href="#noticias" class="font-semibold text-red-600 hover:text-red-500">Leia mais &rarr;</a>
                </div>
            </div>`;
    });
}

function renderAboutPage() {
    renderPage('template-sobre');
    document.getElementById('about-mission-text').innerHTML = appState.pageContent.about.mission || "Carregando...";
}

function renderNewsPage() {
    renderPage('template-noticias');
    const newsGrid = document.getElementById('all-news-grid');
    if (!newsGrid) return;
    newsGrid.innerHTML = '';
    appState.news.forEach(article => {
         newsGrid.innerHTML += `
            <div class="bg-gray-800 rounded-lg overflow-hidden shadow-lg">
                <img src="${article.image}" class="w-full h-48 object-cover">
                <div class="p-6">
                    <span class="text-sm text-red-500">${article.date}</span>
                    <h3 class="text-xl font-bold mt-2 mb-3">${article.title}</h3>
                    <p class="text-gray-400 text-sm">${article.content}</p>
                </div>
            </div>`;
    });
}

function renderCalendarPage() {
    renderPage('template-calendario');
    const container = document.getElementById('calendar-container');
    if (!container) return;

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

function renderGalleryPage() {
    renderPage('template-galeria');
    const galleryGrid = document.getElementById('gallery-grid');
    if (!galleryGrid) return;
    galleryGrid.innerHTML = appState.galleryImages.map(img => `
        <div class="bg-gray-800 rounded-lg overflow-hidden shadow-lg group cursor-pointer" data-gallery-url="${img.url}">
            <img src="${img.url.replace('1200x800', '600x400')}" alt="Foto da Galeria" class="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105">
        </div>
    `).join('') || '<p class="text-center text-gray-400 col-span-3">Nenhuma foto na galeria ainda.</p>';
}

function renderShopPage() {
    renderPage('template-loja');
    const productsGrid = document.getElementById('products-grid');
    if(!productsGrid) return;
    productsGrid.innerHTML = '';
    appState.products.forEach(product => {
        productsGrid.innerHTML += `
            <div class="bg-gray-800 rounded-lg overflow-hidden shadow-lg group flex flex-col">
                <div class="cursor-pointer" data-product-id="${product.id}">
                    <img src="${product.image}" alt="${product.name}" class="w-full h-64 object-cover">
                </div>
                <div class="p-6 text-center flex-grow flex flex-col">
                    <h3 class="text-xl font-bold mb-2 flex-grow">${product.name}</h3>
                    <p class="text-2xl font-semibold text-red-500 mb-4">R$ ${product.price.toFixed(2).replace('.', ',')}</p>
                    <button data-add-to-cart="${product.id}" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Adicionar ao Carrinho</button>
                </div>
            </div>`;
    });
}

function renderCartPage() {
    renderPage('template-carrinho');
    updateCartDisplay();
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
            showCustomAlert('Sucesso!', 'Sua inscrição foi enviada e será avaliada por nossa equipe.');
        form.reset();
    } catch (error) {
        console.error("Erro ao enviar inscrição: ", error);
            showCustomAlert('Erro', 'Houve um problema ao enviar sua inscrição. Por favor, tente novamente mais tarde.');
    }
}

function renderInscriptionPage() {
    renderPage('template-inscricao');
    const inscriptionForm = document.getElementById('inscription-form');
    if (inscriptionForm) {
        inscriptionForm.addEventListener('submit', handleInscriptionSubmit);
    }
}

async function handleUserLoginSubmit(e) {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        navigateTo('account'); // Redirect to account page on successful login
    } catch (error) {
        console.error("Erro de login: ", error.code);
            showCustomAlert('Erro de Login', 'O e-mail ou a senha que você digitou estão incorretos. Por favor, verifique e tente novamente.');
    }
}

function renderUserLoginPage() {
    renderPage('template-login');
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleUserLoginSubmit);
    }
}

async function handleRegistrationSubmit(e) {
    e.preventDefault();
    const name = e.target.name.value;
    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });

        // Force a state change to update the UI
        appState.currentUser = auth.currentUser;
        handleUserAuthState(auth.currentUser);

        showCustomAlert('Bem-vindo!', `Sua conta foi criada com sucesso, ${name}.`);
        navigateTo('home');
    } catch (error) {
        console.error("Erro no cadastro: ", error);
        let message = 'Ocorreu um erro ao criar sua conta. Por favor, tente novamente.';
        if (error.code === 'auth/email-already-in-use') {
            message = 'Este e-mail já está em uso. Por favor, tente fazer login ou use um e-mail diferente.';
        } else if (error.code === 'auth/weak-password') {
            message = 'Sua senha é muito fraca. Por favor, use pelo menos 6 caracteres.';
        }
        showCustomAlert('Erro no Cadastro', message);
    }
}

function renderSignupPage() {
    renderPage('template-signup');
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', handleRegistrationSubmit);
    }
}

async function handleAdminLoginSubmit(e) {
    e.preventDefault();
    const email = e.target.elements['admin-email'].value;
    const password = e.target.elements['admin-password'].value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // A onAuthStateChanged vai pegar a mudança e redirecionar para o painel de admin
        navigateTo('admin');
    } catch (error) {
        console.error("Erro de login do admin: ", error.code);
        showCustomAlert('Erro de Login', 'As credenciais de administrador estão incorretas.');
    }
}

function renderAdminLoginPage() {
    renderPage('template-admin-login');
    const adminLoginForm = document.getElementById('admin-login-form');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLoginSubmit);
    }
}

function renderAdminPage() {
    // We will refine this logic in the next step. For now, it might redirect to user login.
    if (!appState.currentUser) {
        navigateTo('admin-login');
        return;
    }
    renderPage('template-admin');
    const adminNav = document.getElementById('admin-nav');
    if(adminNav) {
        adminNav.addEventListener('click', (e) => {
            const link = e.target.closest('.admin-nav-link');
            if (link && link.dataset.section) {
                e.preventDefault();
                renderAdminSection(link.dataset.section);
            }
        });
    }
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await signOut(auth);
            navigateTo('home');
        });
    }
    renderAdminSection('dashboard');
}

async function renderAccountPage() {
    if (!appState.currentUser) {
        showCustomAlert("Acesso Negado", "Você precisa estar logado para acessar esta página.");
        navigateTo('login');
        return;
    }

    renderPage('template-account');

    // Populate profile form
    document.getElementById('accountName').value = appState.currentUser.displayName || '';
    document.getElementById('accountEmail').value = appState.currentUser.email || '';

    // Add event listeners for profile and password forms
    document.getElementById('profile-form').addEventListener('submit', handleProfileUpdate);
    document.getElementById('password-form').addEventListener('submit', handlePasswordUpdate);

    // Fetch and display order history
    const orderHistoryContainer = document.getElementById('order-history-container');
    orderHistoryContainer.innerHTML = '<p class="text-gray-400">Carregando histórico de compras...</p>';

    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where("userId", "==", appState.currentUser.uid), orderBy("createdAt", "desc"));

    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            orderHistoryContainer.innerHTML = '<p class="text-gray-400">Nenhuma compra encontrada.</p>';
            return;
        }

        let ordersHTML = '';
        querySnapshot.forEach(doc => {
            const order = doc.data();
            const orderDate = order.createdAt.toDate().toLocaleDateString('pt-BR');
            const total = (order.totalAmount / 100).toFixed(2).replace('.', ',');
            const itemsHTML = order.items.map(item => `<li>${item.quantity}x ${item.name}</li>`).join('');

            ordersHTML += `
                <div class="bg-gray-700 p-4 rounded-lg">
                    <div class="flex justify-between items-center mb-2">
                        <p class="font-bold">Pedido: ${doc.id}</p>
                        <p class="text-sm text-gray-400">Data: ${orderDate}</p>
                    </div>
                    <ul class="list-disc list-inside text-gray-300 mb-2">
                        ${itemsHTML}
                    </ul>
                    <p class="text-right font-bold">Total: R$ ${total}</p>
                </div>
            `;
        });
        orderHistoryContainer.innerHTML = ordersHTML;
    } catch (error) {
        console.error("Error fetching order history: ", error);
        orderHistoryContainer.innerHTML = '<p class="text-red-500">Erro ao carregar o histórico de compras.</p>';
    }
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
    showCustomAlert('Produto Adicionado!', `<b>${product.name}</b> foi adicionado ao seu carrinho de compras.`);
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
    const summaryContainer = document.getElementById('cart-summary');
    if (!container || !summaryContainer) return;

    if (cart.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400">Seu carrinho está vazio.</p>';
        summaryContainer.innerHTML = '';
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="flex items-center justify-between bg-gray-800 p-4 rounded-lg mb-4 flex-wrap">
            <div class="flex items-center mb-4 sm:mb-0">
                <img src="${item.image}" class="w-20 h-20 object-cover rounded-md mr-4">
                <div>
                    <h3 class="font-bold text-lg">${item.name}</h3>
                    <p class="text-red-500">R$ ${item.price.toFixed(2).replace('.', ',')}</p>
                </div>
            </div>
            <div class="flex items-center gap-4 w-full sm:w-auto justify-end">
                <div class="flex items-center border border-gray-600 rounded">
                    <button data-update-cart="${item.id}" data-change="-1" class="px-3 py-1">-</button>
                    <span class="px-4">${item.quantity}</span>
                    <button data-update-cart="${item.id}" data-change="1" class="px-3 py-1">+</button>
                </div>
                <p class="font-bold w-24 text-right">R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
                <button data-remove-from-cart="${item.id}" class="text-gray-400 hover:text-red-500 text-2xl">&times;</button>
            </div>
        </div>`).join('');

    // Shipping Options Section
    let shippingHTML = '<h3 class="text-xl font-bold mt-8 mb-4">Opções de Frete</h3>';
    if (appState.shipping_options && appState.shipping_options.length > 0) {
        shippingHTML += appState.shipping_options.map((opt, index) => `
            <div class="flex items-center justify-between bg-gray-800 p-4 rounded-lg mb-2">
                <label for="shipping-${opt.id}" class="flex-grow cursor-pointer">
                    <input type="radio" id="shipping-${opt.id}" name="shipping-option" value="${opt.id}" data-cost="${opt.cost}" class="mr-2" ${index === 0 ? 'checked' : ''}>
                    <span>${opt.name}</span>
                </label>
                <span class="font-semibold">R$ ${opt.cost.toFixed(2).replace('.', ',')}</span>
            </div>
        `).join('');
    } else {
        shippingHTML += '<p class="text-gray-400">Nenhuma opção de frete disponível.</p>';
    }
    // Inject shipping options right after the cart items
    if (!document.getElementById('shipping-options-container')) {
        container.insertAdjacentHTML('afterend', `<div id="shipping-options-container">${shippingHTML}</div>`);
    } else {
        document.getElementById('shipping-options-container').innerHTML = shippingHTML;
    }

    updateCartSummary();

    // Add event listener to shipping radio buttons
    document.querySelectorAll('input[name="shipping-option"]').forEach(radio => {
        radio.addEventListener('change', updateCartSummary);
    });
}

function updateCartSummary() {
    const summaryContainer = document.getElementById('cart-summary');
    if (!summaryContainer) return;

    const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

    let shippingCost = 0;
    const selectedShipping = document.querySelector('input[name="shipping-option"]:checked');
    if (selectedShipping) {
        shippingCost = parseFloat(selectedShipping.dataset.cost);
    }

    const total = subtotal + shippingCost;

    summaryContainer.innerHTML = `
        <div class="space-y-2 text-lg">
            <div class="flex justify-between"><span>Subtotal:</span> <span>R$ ${subtotal.toFixed(2).replace('.', ',')}</span></div>
            <div class="flex justify-between"><span>Frete:</span> <span>R$ ${shippingCost.toFixed(2).replace('.', ',')}</span></div>
            <hr class="my-2 border-gray-600">
            <div class="flex justify-between font-bold text-2xl"><span class="text-red-500">Total:</span> <span class="text-red-500">R$ ${total.toFixed(2).replace('.', ',')}</span></div>
        </div>
        <button data-checkout class="mt-6 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg">Finalizar Compra</button>
    `;
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

function showCustomAlert(title, message) {
    const contentHTML = `
        <div class="text-center">
            <h2 class="text-2xl font-bold mb-4">${title}</h2>
            <p class="text-gray-300 mb-6">${message}</p>
            <button data-close-modal="generic-modal" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg">OK</button>
        </div>
    `;
    openModal('generic-modal', null, contentHTML);
}

async function handleCheckout() {
    if (cart.length === 0) {
        showCustomAlert("Carrinho Vazio", "Você precisa adicionar itens ao carrinho antes de finalizar a compra.");
        return;
    }
    if (!appState.currentUser) {
        showCustomAlert("Login Necessário", "Você precisa estar logado para finalizar a compra. Estamos te redirecionando para a página de login.");
        navigateTo('login');
        return;
    }

    const selectedShipping = document.querySelector('input[name="shipping-option"]:checked');
    if (!selectedShipping && appState.shipping_options.length > 0) {
        showCustomAlert("Frete Necessário", "Por favor, selecione uma opção de frete.");
        return;
    }

    const shippingDetails = selectedShipping ? {
        id: selectedShipping.value,
        cost: parseFloat(selectedShipping.dataset.cost)
    } : null;

    try {
        // The URL will be http://localhost:3000 for local dev,
        // and the public Render URL in production.
        // For now, we'll hardcode the relative path.
        const response = await fetch('/create-checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                items: cart,
                shipping: shippingDetails,
                userId: appState.currentUser.uid,
                userEmail: appState.currentUser.email,
                userName: appState.currentUser.displayName,
            }),
        });

        if (!response.ok) {
            throw new Error('A resposta do servidor não foi OK.');
        }

        const result = await response.json();

        if (result && result.checkoutUrl) {
            window.location.href = result.checkoutUrl;
        } else {
            throw new Error("URL de checkout não recebida.");
        }
    } catch (error) {
        console.error("Erro ao finalizar a compra: ", error);
        showCustomAlert("Erro no Checkout", "Ocorreu um erro ao tentar se comunicar com o sistema de pagamento. Por favor, tente novamente mais tarde.");
    }
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
        'frete': renderAdminShipping, 'inscricoes': renderAdminRegistrations,
    };
    if(renderers[section]) renderers[section]();
}

function renderAdminShipping() {
    const contentArea = adminContentArea();
    if (!contentArea) return;

    contentArea.innerHTML = `
        <h2 class="text-2xl font-bold mb-4">Gerenciar Opções de Frete</h2>
        <form id="shipping-form" class="mb-8 bg-gray-800 p-4 rounded-lg flex gap-4 items-end">
            <div class="flex-grow">
                <label for="shippingName" class="block text-sm font-semibold mb-2 text-gray-300">Nome da Opção (ex: SEDEX)</label>
                <input type="text" id="shippingName" name="shippingName" class="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-4" required>
            </div>
            <div class="flex-grow">
                <label for="shippingCost" class="block text-sm font-semibold mb-2 text-gray-300">Custo (ex: 25.50)</label>
                <input type="number" step="0.01" id="shippingCost" name="shippingCost" class="w-full bg-gray-700 border border-gray-600 rounded-lg py-2 px-4" required>
            </div>
            <button type="submit" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Adicionar Opção</button>
        </form>
        <div id="shipping-options-table" class="bg-gray-800 rounded-lg overflow-x-auto">
            <!-- Tabela será preenchida aqui -->
        </div>
    `;

    populateShippingTable();
    document.getElementById('shipping-form').addEventListener('submit', saveShippingOption);
}

function populateShippingTable() {
    const tableContainer = document.getElementById('shipping-options-table');
    if (!tableContainer) return;

    let tableHTML = `<table class="w-full text-left min-w-max">
        <thead class="bg-gray-700"><tr><th class="p-4">Nome</th><th class="p-4">Custo</th><th class="p-4">Ações</th></tr></thead>
        <tbody>`;

    if (appState.shipping_options && appState.shipping_options.length > 0) {
        appState.shipping_options.forEach(option => {
            tableHTML += `<tr class="border-b border-gray-700">
                <td class="p-4">${option.name}</td>
                <td class="p-4">R$ ${option.cost.toFixed(2).replace('.', ',')}</td>
                <td class="p-4"><button data-admin-action="delete-shipping" data-id="${option.id}" class="text-red-500 hover:text-red-400">Excluir</button></td>
            </tr>`;
        });
    } else {
        tableHTML += '<tr><td colspan="3" class="p-4 text-center text-gray-400">Nenhuma opção de frete cadastrada.</td></tr>';
    }

    tableHTML += '</tbody></table>';
    tableContainer.innerHTML = tableHTML;
}

async function saveShippingOption(e) {
    e.preventDefault();
    const name = e.target.shippingName.value;
    const cost = parseFloat(e.target.shippingCost.value);

    if (name && !isNaN(cost)) {
        await addDoc(getCollectionRef('shipping_options'), { name, cost });
        e.target.reset();
    }
}

async function deleteShippingOption(id) {
    if (confirm('Tem certeza que deseja excluir esta opção de frete?')) {
        await deleteDoc(getDocRef('shipping_options', id));
    }
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
                        <div class="mb-4"><label class="block mb-2">URL do Vídeo de Fundo</label><input type="url" name="backgroundVideoUrl" class="w-full bg-gray-700 p-2 rounded" value="${appState.pageContent.home.backgroundVideoUrl || ''}"></div>
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
        <div class="flex justify-between items-center mb-4"><h2 class="text-2xl font-bold">Gerenciar Notícias</h2><button data-admin-action="open-news-modal" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Nova Postagem</button></div>
        <div class="bg-gray-800 rounded-lg overflow-x-auto"><table class="w-full text-left min-w-max">
            <thead class="bg-gray-700"><tr><th class="p-4">Título</th><th class="p-4">Data</th><th class="p-4">Ações</th></tr></thead>
            <tbody>
                ${appState.news.map(article => `<tr class="border-b border-gray-700">
                    <td class="p-4">${article.title}</td><td class="p-4">${article.date}</td>
                    <td class="p-4 whitespace-nowrap"><button data-admin-action="open-news-modal" data-id="${article.id}" class="text-green-400 hover:text-green-300 mr-4">Editar</button><button data-admin-action="delete-news" data-id="${article.id}" class="text-red-500 hover:text-red-400">Excluir</button></td>
                </tr>`).join('') || '<tr><td colspan="3" class="p-4 text-center text-gray-400">Nenhuma notícia encontrada.</td></tr>'}
            </tbody></table></div>`;
}

function renderAdminCalendar() {
    const contentArea = adminContentArea();
    if (contentArea) contentArea.innerHTML = `
        <div class="flex justify-between items-center mb-4"><h2 class="text-2xl font-bold">Gerenciar Calendário</h2><button data-admin-action="open-calendar-modal" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Novo Evento</button></div>
        <div class="bg-gray-800 rounded-lg overflow-x-auto"><table class="w-full text-left min-w-max">
            <thead class="bg-gray-700"><tr><th class="p-4">Data</th><th class="p-4">Evento</th><th class="p-4">Local</th><th class="p-4">Ações</th></tr></thead>
            <tbody>
                ${[...appState.calendarEvents].sort((a,b) => new Date(a.date) - new Date(b.date)).map(event => `<tr class="border-b border-gray-700">
                    <td class="p-4">${new Date(event.date + 'T00:00:00-03:00').toLocaleDateString('pt-BR')}</td><td class="p-4">${event.event}</td><td class="p-4">${event.location}</td>
                    <td class="p-4 whitespace-nowrap"><button data-admin-action="open-calendar-modal" data-id="${event.id}" class="text-green-400 hover:text-green-300 mr-4">Editar</button><button data-admin-action="delete-calendar" data-id="${event.id}" class="text-red-500 hover:text-red-400">Excluir</button></td>
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
                    <td class="p-4"><img src="${img.url.replace('1200x800', '600x400')}" class="h-16 w-24 object-cover rounded"></td>
                    <td class="p-4"><button data-admin-action="delete-gallery" data-id="${img.id}" class="text-red-500 hover:text-red-400">Excluir</button></td>
                </tr>`).join('') || '<tr><td colspan="2" class="p-4 text-center text-gray-400">Nenhuma foto na galeria.</td></tr>'}
            </tbody></table></div>`;
    document.getElementById('gallery-form').addEventListener('submit', addGalleryImage);
}

function renderAdminShop() {
    const contentArea = adminContentArea();
    if (contentArea) contentArea.innerHTML = `
        <div class="flex justify-between items-center mb-4"><h2 class="text-2xl font-bold">Gerenciar Loja</h2><button data-admin-action="open-product-modal" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Novo Produto</button></div>
        <div class="bg-gray-800 rounded-lg overflow-x-auto"><table class="w-full text-left min-w-max">
            <thead class="bg-gray-700"><tr><th class="p-4">Produto</th><th class="p-4">Preço</th><th class="p-4">Ações</th></tr></thead>
            <tbody>
                ${appState.products.map(product => `<tr class="border-b border-gray-700">
                    <td class="p-4 flex items-center"><img src="${product.image}" class="h-12 w-12 object-cover rounded mr-4"> ${product.name}</td>
                    <td class="p-4">R$ ${product.price.toFixed(2).replace('.', ',')}</td>
                    <td class="p-4 whitespace-nowrap"><button data-admin-action="open-product-modal" data-id="${product.id}" class="text-green-400 hover:text-green-300 mr-4">Editar</button><button data-admin-action="delete-product" data-id="${product.id}" class="text-red-500 hover:text-red-400">Excluir</button></td>
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
    if (product) openModal('generic-modal', null, `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div><img src="${product.image}" alt="${product.name}" class="w-full h-auto object-cover rounded-lg"></div>
            <div><h2 class="text-3xl font-bold mb-2">${product.name}</h2><p class="text-3xl font-semibold text-red-500 mb-4">R$ ${product.price.toFixed(2).replace('.', ',')}</p><p class="text-gray-300 mb-6">${product.description}</p>
            <button data-add-to-cart="${product.id}" data-close-modal="generic-modal" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300">Adicionar ao Carrinho</button></div>
        </div><button data-close-modal="generic-modal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl">&times;</button>`);
}

function openNewsModal(id = null) {
    const article = id ? appState.news.find(a => a.id === id) : null;
    openModal('generic-modal', null, `
        <h2 class="text-2xl font-bold mb-6">${id ? 'Editar' : 'Nova'} Notícia</h2><form id="news-form"><input type="hidden" name="id" value="${id || ''}">
            <div class="mb-4"><label class="block mb-2">Título</label><input type="text" name="title" class="w-full bg-gray-700 p-2 rounded" value="${article?.title || ''}" required></div>
            <div class="mb-4"><label class="block mb-2">Conteúdo</label><textarea name="content" rows="4" class="w-full bg-gray-700 p-2 rounded" required>${article?.content || ''}</textarea></div>
            <div class="mb-6"><label class="block mb-2">URL da Imagem</label><input type="text" name="image" class="w-full bg-gray-700 p-2 rounded" value="${article?.image || 'https://images.unsplash.com/photo-1593344484962-796b16d49b1a?auto=format&fit=crop&w=600&q=80'}" required>
            <small class="text-gray-400 mt-1 block">Em um site real, aqui seria um botão de upload de arquivo.</small></div>
            <div class="flex justify-end gap-4"><button type="button" data-close-modal="generic-modal" class="bg-gray-600 hover:bg-gray-700 py-2 px-4 rounded">Cancelar</button><button type="submit" class="bg-red-600 hover:bg-red-700 py-2 px-4 rounded">Salvar</button></div>
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
            <div class="mb-6"><label class="block mb-2">URL da Imagem</label><input type="text" name="image" class="w-full bg-gray-700 p-2 rounded" value="${product?.image || 'https://images.unsplash.com/photo-1517649763942-32a3a7b3b733?auto=format&fit=crop&w=600&q=80'}" required>
            <small class="text-gray-400 mt-1 block">Em um site real, aqui seria um botão de upload de arquivo.</small></div>
            <div class="flex justify-end gap-4"><button type="button" data-close-modal="generic-modal" class="bg-gray-600 hover:bg-gray-700 py-2 px-4 rounded">Cancelar</button><button type="submit" class="bg-red-600 hover:bg-red-700 py-2 px-4 rounded">Salvar</button></div>
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
            <div class="flex justify-end gap-4"><button type="button" data-close-modal="generic-modal" class="bg-gray-600 hover:bg-gray-700 py-2 px-4 rounded">Cancelar</button><button type="submit" class="bg-red-600 hover:bg-red-700 py-2 px-4 rounded">Salvar</button></div>
        </form>`);
    document.getElementById('calendar-event-form').addEventListener('submit', saveCalendarEvent);
}

function openForgotPasswordModal(e) {
    e.preventDefault();
    openModal('generic-modal', null, `
        <h2 class="text-2xl font-bold mb-6">Redefinir Senha</h2><form id="forgot-password-form">
            <p class="text-gray-400 mb-4">Digite seu e-mail para enviarmos um link de redefinição de senha.</p>
            <div class="mb-6"><label class="block mb-2">E-mail</label><input type="email" name="email" class="w-full bg-gray-700 p-2 rounded" placeholder="seuemail@exemplo.com" required></div>
            <div class="flex justify-end gap-4"><button type="button" data-close-modal="generic-modal" class="bg-gray-600 hover:bg-gray-700 py-2 px-4 rounded">Cancelar</button><button type="submit" class="bg-red-600 hover:bg-red-700 py-2 px-4 rounded">Enviar Link</button></div>
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
        showCustomAlert('Link Enviado', 'Se o e-mail estiver correto, você receberá um link para redefinir sua senha em breve.');
    } catch (error) {
        console.error("Erro ao enviar email de redefinição: ", error);
        showCustomAlert('Erro', 'Houve um problema ao enviar o e-mail de redefinição. Verifique o endereço digitado e tente novamente.');
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
        backgroundVideoUrl: formData.get('backgroundVideoUrl'),
    };
    await setDoc(doc(db, `artifacts/${appId}/public/data/pages/home`), content, { merge: true });
    showCustomAlert('Sucesso', 'O conteúdo da Página Home foi salvo.');
}

async function saveAboutPageContent(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const missionText = formData.get('mission');
    const content = {
        mission: missionText.split('\n\n').map(p => `<p class="${p === missionText.split('\n\n').slice(-1)[0] ? '' : 'mb-4'}">${p}</p>`).join('')
    };
    await setDoc(doc(db, `artifacts/${appId}/public/data/pages/about`), content, { merge: true });
    showCustomAlert('Sucesso', 'O conteúdo da Página Sobre foi salvo.');
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
    'carrinho': renderCartPage, 'inscricao': renderInscriptionPage, 'login': renderUserLoginPage,
    'signup': renderSignupPage, 'account': renderAccountPage, 'admin-login': renderAdminLoginPage, 'admin': renderAdminPage
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
            renderFunction(); appRoot.style.opacity = 1; window.scrollTo(0, 0);
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

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
}

function setupRealtimeListeners() {
    const collections = ['calendarEvents', 'products', 'news', 'registrations', 'galleryImages', 'shipping_options'];
    collections.forEach(col => {
        onSnapshot(getCollectionRef(col), snapshot => {
            appState[col] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const currentPage = window.location.hash.substring(1) || 'home';
            if (pageRenderers[currentPage] && appRoot.innerHTML) {
                navigateTo(currentPage);
            }
        }, error => console.error(`Erro no listener da coleção ${col}: `, error));
    });

    onSnapshot(doc(db, `artifacts/${appId}/public/data/pages/home`), doc => {
        appState.pageContent.home = doc.data() || { headline: 'Vôlei Futuro', subheadline: 'Bem-vindo ao nosso site!' };
         const currentPage = window.location.hash.substring(1) || 'home';
         if(currentPage === 'home' && appRoot.innerHTML) renderHomePage();
    }, error => console.error("Erro no listener da página home: ", error));

    onSnapshot(doc(db, `artifacts/${appId}/public/data/pages/about`), doc => {
        appState.pageContent.about = doc.data() || { mission: 'Nossa missão...' };
        const currentPage = window.location.hash.substring(1) || 'home';
        if(currentPage === 'sobre' && appRoot.innerHTML) renderAboutPage();
    }, error => console.error("Erro no listener da página about: ", error));
}

function handleUserAuthState(user) {
    const userAuthLinks = document.getElementById('user-auth-links');
    const userAccountLinks = document.getElementById('user-account-links');

    if (user) {
        appState.currentUser = user;
        userAuthLinks.classList.add('hidden');
        userAccountLinks.classList.remove('hidden');
    } else {
        appState.currentUser = null;
        userAuthLinks.classList.remove('hidden');
        userAccountLinks.classList.add('hidden');
    }
}

function handleInitialPageLoad() {
    updateCartBadge();
    let listenersAttached = false;
    onAuthStateChanged(auth, user => {
        handleUserAuthState(user);
        if (!listenersAttached) {
            setupRealtimeListeners();
            listenersAttached = true;
        }

        const initialPage = window.location.hash.substring(1) || 'home';

        // If a logged-out user tries to access a protected page, redirect them.
        const protectedPages = ['account', 'admin'];
        if (!user && protectedPages.includes(initialPage)) {
            navigateTo('login');
        } else {
            navigateTo(initialPage);
        }
    });
}

function addEventListeners() {
    mobileMenuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));

    const userMenuButton = document.getElementById('user-menu-button');
    const userDropdownMenu = document.getElementById('user-dropdown-menu');

    userMenuButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent the document click listener from firing immediately
        userDropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', e => {
        // Close dropdown if clicked outside
        if (!userMenuButton.contains(e.target) && !userDropdownMenu.contains(e.target)) {
            userDropdownMenu.classList.add('hidden');
        }

        // Main navigation
        const navLink = e.target.closest('a[href^="#"]');
        if (navLink && !navLink.closest('#admin-nav')) {
            e.preventDefault();
            const pageId = navLink.getAttribute('href').substring(1);
            if (navLink.closest('#mobile-menu')) closeMobileMenu();
            if (navLink.closest('#user-dropdown-menu')) {
                userDropdownMenu.classList.add('hidden');
            }
            if (pageId) navigateTo(pageId);
            return;
        }

        // Modal closing
        const closeModalButton = e.target.closest('[data-close-modal]');
        if (closeModalButton) {
            closeModal(closeModalButton.dataset.closeModal);
            return;
        }
        if (e.target.id === 'lightbox-modal' || e.target.id === 'generic-modal') {
            closeModal(e.target.id);
            return;
        }

        // Gallery
        const galleryImage = e.target.closest('[data-gallery-url]');
        if (galleryImage) {
            openModal('lightbox-modal', galleryImage.dataset.galleryUrl);
            return;
        }

        // Shop
        const productDetailLink = e.target.closest('[data-product-id]');
        if (productDetailLink) {
            openProductDetailModal(productDetailLink.dataset.productId);
            return;
        }
        const addToCartButton = e.target.closest('[data-add-to-cart]');
        if (addToCartButton) {
            addToCart(addToCartButton.dataset.addToCart);
            if (addToCartButton.dataset.closeModal) {
                closeModal(addToCartButton.dataset.closeModal);
            }
            return;
        }
        const updateCartButton = e.target.closest('[data-update-cart]');
        if (updateCartButton) {
            const { updateCart, change } = updateCartButton.dataset;
            updateCartQuantity(updateCart, parseInt(change, 10));
            return;
        }
        const removeFromCartButton = e.target.closest('[data-remove-from-cart]');
        if(removeFromCartButton) {
            removeFromCart(removeFromCartButton.dataset.removeFromCart);
            return;
        }
        const checkoutButton = e.target.closest('[data-checkout]');
        if (checkoutButton) {
            handleCheckout();
            return;
        }

        // Login
        const forgotPasswordLink = e.target.closest('[data-forgot-password]');
        if (forgotPasswordLink) {
            openForgotPasswordModal(e);
            return;
        }

        // Admin Actions
        const logoutButton = e.target.closest('#logout-button-user');
        if (logoutButton) {
            signOut(auth);
            return;
        }

        const adminButton = e.target.closest('[data-admin-action]');
        if (adminButton) {
            const { adminAction, id } = adminButton.dataset;
            const actions = {
                'open-news-modal': () => openNewsModal(id),
                'delete-news': () => deleteNews(id),
                'open-calendar-modal': () => openCalendarEventModal(id),
                'delete-calendar': () => deleteCalendarEvent(id),
                'delete-gallery': () => deleteGalleryImage(id),
                'open-product-modal': () => openProductModal(id),
                'delete-product': () => deleteProduct(id),
                'delete-shipping': () => deleteShippingOption(id),
            };
            if (actions[adminAction]) {
                actions[adminAction]();
            }
            return;
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeModal('lightbox-modal');
            closeModal('generic-modal');
        }
    });

    window.addEventListener('popstate', (event) => {
        const pageId = event.state?.pageId || window.location.hash.substring(1) || 'home';
        navigateTo(pageId);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    handleInitialPageLoad();
    addEventListeners();
});
