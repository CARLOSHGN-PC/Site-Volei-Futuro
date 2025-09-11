require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const axios = require('axios');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Initialize Firebase Admin SDK
// The credentials will be loaded from an environment variable
// which the user will need to set up on Render.
const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('ascii'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();

// Middleware
app.use(cors()); // In a real production environment, you should configure this more securely.
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files from the root directory

// Routes
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.post('/calculate-shipping', async (req, res) => {
    const { cepDestino, items } = req.body;

    if (!cepDestino || !items) {
        return res.status(400).json({ error: 'CEP de destino e itens do carrinho são obrigatórios.' });
    }

    const payload = {
        "SellerCEP": "01451001",
        "RecipientCEP": cepDestino,
        "ShipmentInvoiceValue": items.reduce((total, item) => total + (item.price * item.quantity), 0),
        "ShippingItemArray": items.map(item => ({
            "Height": 5,
            "Length": 20,
            "Width": 15,
            "Weight": 1,
            "Quantity": item.quantity
        })),
    };

    try {
        const response = await axios.post('https://api.frenet.com.br/shipping/quote', payload, {
            headers: {
                'Content-Type': 'application/json',
                'token': process.env.FRENET_TOKEN
            }
        });

        const services = response.data.ShippingSevicesArray;
        if (!services) {
            return res.json([]);
        }

        const results = services
            .filter(service => !service.ServiceDescription.includes('Mini Envios'))
            .map(service => ({
                Codigo: service.ServiceCode,
                Valor: service.ShippingPrice,
                PrazoEntrega: service.DeliveryTime,
                Servico: service.ServiceDescription
            }));

        res.json(results);
    } catch (error) {
        console.error('Erro ao calcular frete com Frenet:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Falha ao calcular o frete.', details: error.message });
    }
});

app.post('/create-checkout', async (req, res) => {
    const { items, shipping, userId, userEmail, userName, customer } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Cart items are required.' });
    }
    if (!customer || !customer.cpf || !customer.address) {
        return res.status(400).json({ error: 'Customer CPF and address are required.' });
    }

    const orderItems = items.map(item => ({
        "name": item.name,
        "quantity": item.quantity,
        "unit_amount": Math.round(item.price * 100)
    }));

    const subtotal = orderItems.reduce((total, item) => total + (item.unit_amount * item.quantity), 0);
    const shippingCost = shipping ? Math.round(shipping.cost * 100) : 0;
    const totalAmount = subtotal + shippingCost;
    const orderReferenceId = `ref_${userId}_${new Date().getTime()}`;

    const payload = {
        "reference_id": orderReferenceId,
        "customer": {
            "name": userName || 'Anonymous User',
            "email": userEmail,
            "tax_id": customer.cpf.replace(/\D/g, ''),
        },
        "items": orderItems,
        "shipping": {
            "amount": shippingCost,
            "address": {
                "street": customer.address.street,
                "number": customer.address.number,
                "complement": customer.address.complement,
                "locality": customer.address.neighborhood,
                "city": customer.address.city,
                "region_code": customer.address.state,
                "country": "BRA",
                "postal_code": customer.address.zipcode.replace(/\D/g, ''),
            }
        },
        "notification_urls": [],
        "charges": [{
            "reference_id": orderReferenceId,
            "description": "Venda de produtos Vôlei Futuro",
            "amount": { "value": totalAmount, "currency": "BRL" },
            "payment_method": { "type": "BOLETO", "capture": true }
        }]
    };

    try {
        const response = await axios.post('https://api.pagseguro.com/orders', payload, {
            headers: {
                'Authorization': `Bearer ${process.env.PAGSEGURO_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const checkoutLink = response.data.links.find(link => link.rel === 'PAY');
        if (!checkoutLink) {
            return res.status(500).json({ error: 'Checkout link not found in PagSeguro response' });
        }

        // Save order to Firestore
        const orderPayload = {
            userId: userId,
            pagseguroOrderId: response.data.id,
            referenceId: orderReferenceId,
            createdAt: new Date(),
            items: orderItems,
            shipping: shipping,
            totalAmount: totalAmount,
            status: 'PENDING'
        };
        await admin.firestore().collection('orders').add(orderPayload);

        res.json({ checkoutUrl: checkoutLink.href });

    } catch (error) {
        console.error("Error creating PagSeguro checkout:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Could not create a PagSeguro checkout session.' });
    }
});

app.post('/send-email', async (req, res) => {
    const { to, from, subject, html, secret } = req.body;

    if (secret !== process.env.EMAIL_ENDPOINT_SECRET) {
        console.warn('Unauthorized attempt to send email.');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!to || !from || !subject || !html) {
        return res.status(400).json({ error: 'Missing required email fields.' });
    }

    const msg = { to, from, subject, html };

    try {
        await sgMail.send(msg);
        res.status(200).json({ message: 'Email sent successfully.' });
    } catch (error) {
        console.error('Error sending email with SendGrid:', error);
        if (error.response) {
            console.error(error.response.body)
        }
        res.status(500).json({ error: 'Failed to send email.' });
    }
});

app.post('/send-welcome-email', async (req, res) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ error: 'Auth token is required.' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const { name, email } = decodedToken;

        const welcomeEmailHtml = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h1 style="color: #dc2626; text-align: center;">Bem-vindo ao Vôlei Futuro, ${name || ''}!</h1>
                    <p>Olá ${name || 'atleta'},</p>
                    <p>Sua conta em nosso site foi criada com sucesso. Estamos muito felizes por ter você em nossa comunidade.</p>
                    <p>Fique à vontade para explorar nossa <a href="https://volei-futuro.onrender.com/#loja" style="color: #dc2626; text-decoration: none;">loja</a>, acompanhar as <a href="https://volei-futuro.onrender.com/#noticias" style="color: #dc2626; text-decoration: none;">notícias</a> e o <a href="https://volei-futuro.onrender.com/#calendario" style="color: #dc2626; text-decoration: none;">calendário de jogos</a>.</p>
                    <p>Se precisar de algo, estamos à disposição.</p>
                    <p style="margin-top: 30px;">Atenciosamente,<br><strong>Equipe Vôlei Futuro</strong></p>
                </div>
            </div>
        `;

        const msg = {
            to: email,
            from: 'contato@voleifuturo.com', // This MUST be a verified sender in your SendGrid account
            subject: 'Seja Bem-vindo ao Vôlei Futuro!',
            html: welcomeEmailHtml,
        };

        await sgMail.send(msg);
        res.status(200).json({ message: 'Welcome email sent successfully.' });

    } catch (error) {
        console.error('Error verifying token or sending welcome email:', error);
        // Check if the error is from SendGrid and has detailed info
        if (error.response && error.response.body) {
            return res.status(500).json({
                error: 'Failed to send welcome email via SendGrid.',
                details: error.response.body.errors
            });
        }
        // Check if it's a token verification error
        if (error.code && error.code.startsWith('auth/')) {
            return res.status(401).json({
                error: 'Invalid Firebase authentication token.',
                details: error.message
            });
        }
        // Generic error
        res.status(500).json({
            error: 'An unexpected error occurred while sending the welcome email.',
            details: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
