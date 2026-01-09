const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(functions.config().stripe.secret_key);

admin.initializeApp();

// Crea sessione checkout per abbonamento
exports.createSubscriptionCheckout = functions.https.onCall(async (data, context) => {
    // Verifica autenticazione
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Devi essere autenticato');
    }

    const { planType, price, userId, userEmail } = data;

    // Prezzi in centesimi
    const prices = {
        'monthly': functions.config().stripe.price_monthly_id, // ID prezzo mensile da Stripe Dashboard
        'yearly': functions.config().stripe.price_yearly_id     // ID prezzo annuale da Stripe Dashboard
    };

    const priceId = prices[planType];
    if (!priceId) {
        throw new functions.https.HttpsError('invalid-argument', 'Piano non valido');
    }

    // Ottieni l'URL base dell'app
    const appUrl = functions.config().app?.url || 'https://petcalendar-67853.web.app';

    try {
        // Crea sessione checkout
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            customer_email: userEmail,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${appUrl}/admin.html?session_id={CHECKOUT_SESSION_ID}&success=true`,
            cancel_url: `${appUrl}/admin.html?success=false`,
            metadata: {
                userId: userId,
                planType: planType
            },
        });

        return { url: session.url, sessionId: session.id };
    } catch (error) {
        console.error('Errore creazione checkout:', error);
        throw new functions.https.HttpsError('internal', 'Errore nella creazione del checkout');
    }
});

// Webhook per gestire eventi Stripe
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = functions.config().stripe.webhook_secret;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
        console.error('Errore webhook:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const db = admin.firestore();

    // Gestisci diversi tipi di eventi
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            await handleCheckoutCompleted(session, db);
            break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
            const subscription = event.data.object;
            await handleSubscriptionUpdate(subscription, db);
            break;

        case 'customer.subscription.deleted':
            const deletedSubscription = event.data.object;
            await handleSubscriptionCancelled(deletedSubscription, db);
            break;

        case 'invoice.payment_succeeded':
            const invoice = event.data.object;
            await handlePaymentSucceeded(invoice, db);
            break;

        case 'invoice.payment_failed':
            const failedInvoice = event.data.object;
            await handlePaymentFailed(failedInvoice, db);
            break;
    }

    res.json({ received: true });
});

// Gestisci checkout completato
async function handleCheckoutCompleted(session, db) {
    const userId = session.metadata.userId;
    const planType = session.metadata.planType;

    if (!userId) {
        console.error('UserId non trovato nei metadata della sessione');
        return;
    }

    try {
        // Ottieni la subscription da Stripe
        const subscriptionId = session.subscription;
        if (!subscriptionId) {
            console.error('Subscription ID non trovato nella sessione');
            return;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Calcola data di scadenza
        const expiryDate = new Date(subscription.current_period_end * 1000);

        // Aggiorna abbonamento nel database
        await db.collection('subscriptions').doc(userId).set({
            plan: planType === 'monthly' ? 'monthly' : 'yearly',
            status: 'active',
            stripeCustomerId: subscription.customer,
            stripeSubscriptionId: subscription.id,
            startDate: admin.firestore.Timestamp.fromDate(new Date(subscription.current_period_start * 1000)),
            expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`Abbonamento attivato per utente ${userId}`);
    } catch (error) {
        console.error('Errore nella gestione checkout completato:', error);
    }
}

// Gestisci aggiornamento subscription
async function handleSubscriptionUpdate(subscription, db) {
    const customerId = subscription.customer;
    
    try {
        // Trova l'utente tramite customerId
        const subscriptionsSnapshot = await db.collection('subscriptions')
            .where('stripeCustomerId', '==', customerId)
            .limit(1)
            .get();

        if (subscriptionsSnapshot.empty) {
            console.log(`Nessuna subscription trovata per customer ${customerId}`);
            return;
        }

        const subscriptionDoc = subscriptionsSnapshot.docs[0];
        const userId = subscriptionDoc.id;

        const expiryDate = new Date(subscription.current_period_end * 1000);
        
        // Determina il tipo di piano dal price ID
        const priceId = subscription.items.data[0]?.price?.id;
        const monthlyPriceId = functions.config().stripe.price_monthly_id;
        const yearlyPriceId = functions.config().stripe.price_yearly_id;
        
        let planType = 'monthly';
        if (priceId === yearlyPriceId) {
            planType = 'yearly';
        }

        await db.collection('subscriptions').doc(userId).update({
            plan: planType,
            status: subscription.status === 'active' ? 'active' : 'cancelled',
            expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Subscription aggiornata per utente ${userId}`);
    } catch (error) {
        console.error('Errore nella gestione aggiornamento subscription:', error);
    }
}

// Gestisci cancellazione subscription
async function handleSubscriptionCancelled(subscription, db) {
    const customerId = subscription.customer;
    
    try {
        const subscriptionsSnapshot = await db.collection('subscriptions')
            .where('stripeCustomerId', '==', customerId)
            .limit(1)
            .get();

        if (subscriptionsSnapshot.empty) {
            console.log(`Nessuna subscription trovata per customer ${customerId}`);
            return;
        }

        const subscriptionDoc = subscriptionsSnapshot.docs[0];
        const userId = subscriptionDoc.id;

        await db.collection('subscriptions').doc(userId).update({
            status: 'cancelled',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Subscription cancellata per utente ${userId}`);
    } catch (error) {
        console.error('Errore nella gestione cancellazione subscription:', error);
    }
}

// Gestisci pagamento riuscito
async function handlePaymentSucceeded(invoice, db) {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) {
        return;
    }

    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const customerId = subscription.customer;
        
        const subscriptionsSnapshot = await db.collection('subscriptions')
            .where('stripeCustomerId', '==', customerId)
            .limit(1)
            .get();

        if (subscriptionsSnapshot.empty) {
            return;
        }

        const subscriptionDoc = subscriptionsSnapshot.docs[0];
        const userId = subscriptionDoc.id;

        const expiryDate = new Date(subscription.current_period_end * 1000);

        await db.collection('subscriptions').doc(userId).update({
            status: 'active',
            expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Pagamento riuscito per utente ${userId}`);
    } catch (error) {
        console.error('Errore nella gestione pagamento riuscito:', error);
    }
}

// Gestisci pagamento fallito
async function handlePaymentFailed(invoice, db) {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) {
        return;
    }

    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const customerId = subscription.customer;
        
        const subscriptionsSnapshot = await db.collection('subscriptions')
            .where('stripeCustomerId', '==', customerId)
            .limit(1)
            .get();

        if (subscriptionsSnapshot.empty) {
            return;
        }

        const subscriptionDoc = subscriptionsSnapshot.docs[0];
        const userId = subscriptionDoc.id;

        await db.collection('subscriptions').doc(userId).update({
            status: 'past_due',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Pagamento fallito per utente ${userId}`);
    } catch (error) {
        console.error('Errore nella gestione pagamento fallito:', error);
    }
}

