require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const axios = require('axios');

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

app.post('/create-checkout', async (req, res) => {
    const { items, shipping, userId, userEmail, userName } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Cart items are required.' });
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
        },
        "items": orderItems,
        "shipping": {
            "amount": shippingCost,
            "address": {
                "street": "Avenida Brigadeiro Faria Lima", "number": "1384", "complement": "apto 132",
                "locality": "Jardim Paulistano", "city": "Sao Paulo", "region_code": "SP",
                "country": "BRA", "postal_code": "01451001"
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
