const functions = require("firebase-functions");
const {defineString, defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");

// Definisci i parametri usando il nuovo sistema params
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeMonthlyPriceId = defineString("STRIPE_PRICE_MONTHLY_ID");
const stripeYearlyPriceId = defineString("STRIPE_PRICE_YEARLY_ID");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const appUrl = defineString("APP_URL", {default: "https://petcalendar-67853.web.app"});

// Inizializza Stripe con il secret
let stripe = null;

admin.initializeApp();

// Crea sessione checkout per abbonamento
exports.createSubscriptionCheckout = functions.https.onCall({
  secrets: [stripeSecretKey],
}, async (data, context) => {
  // Verifica autenticazione
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated", "Devi essere autenticato");
  }

  // Inizializza Stripe se non già fatto
  if (!stripe) {
    stripe = require("stripe")(stripeSecretKey.value());
  }

  const {planType, userId, userEmail} = data;

  // Prezzi in centesimi
  const prices = {
    // ID prezzo mensile da Stripe Dashboard
    "monthly": stripeMonthlyPriceId.value(),
    // ID prezzo annuale da Stripe Dashboard
    "yearly": stripeYearlyPriceId.value(),
  };

  const priceId = prices[planType];
  if (!priceId) {
    throw new functions.https.HttpsError(
        "invalid-argument", "Piano non valido");
  }

  // Ottieni l'URL base dell'app
  const baseUrl = appUrl.value();

  try {
    // Crea sessione checkout
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: userEmail,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/admin.html?` +
          `session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${baseUrl}/admin.html?success=false`,
      metadata: {
        userId: userId,
        planType: planType,
      },
    });

    return {url: session.url, sessionId: session.id};
  } catch (error) {
    console.error("Errore creazione checkout:", error);
    throw new functions.https.HttpsError(
        "internal", "Errore nella creazione del checkout");
  }
});

// Webhook per gestire eventi Stripe
exports.stripeWebhook = functions.https.onRequest({
  secrets: [stripeSecretKey, stripeWebhookSecret],
}, async (req, res) => {
  // Inizializza Stripe se non già fatto
  if (!stripe) {
    stripe = require("stripe")(stripeSecretKey.value());
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecretValue = stripeWebhookSecret.value();

  let event;

  try {
    event = stripe.webhooks.constructEvent(
        req.rawBody, sig, webhookSecretValue);
  } catch (err) {
    console.error("Errore webhook:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const db = admin.firestore();

  // Gestisci diversi tipi di eventi
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      await handleCheckoutCompleted(session, db, stripe);
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      await handleSubscriptionUpdate(subscription, db, stripe);
      break;
    }

    case "customer.subscription.deleted": {
      const deletedSubscription = event.data.object;
      await handleSubscriptionCancelled(deletedSubscription, db);
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object;
      await handlePaymentSucceeded(invoice, db, stripe);
      break;
    }

    case "invoice.payment_failed": {
      const failedInvoice = event.data.object;
      await handlePaymentFailed(failedInvoice, db, stripe);
      break;
    }
  }

  res.json({received: true});
});

/**
 * Gestisci checkout completato
 * @param {Object} session
 * @param {Object} db
 * @param {Object} stripeInstance
 */
async function handleCheckoutCompleted(session, db, stripeInstance) {
  const userId = session.metadata.userId;
  const planType = session.metadata.planType;

  if (!userId) {
    console.error("UserId non trovato nei metadata della sessione");
    return;
  }

  try {
    // Ottieni la subscription da Stripe
    const subscriptionId = session.subscription;
    if (!subscriptionId) {
      console.error("Subscription ID non trovato nella sessione");
      return;
    }

    const subscription = await stripeInstance.subscriptions.retrieve(
        subscriptionId);

    // Calcola data di scadenza
    const expiryDate = new Date(subscription.current_period_end * 1000);

    // Aggiorna abbonamento nel database
    const startDate = new Date(
        subscription.current_period_start * 1000);
    await db.collection("subscriptions").doc(userId).set({
      plan: planType === "monthly" ? "monthly" : "yearly",
      status: "active",
      stripeCustomerId: subscription.customer,
      stripeSubscriptionId: subscription.id,
      startDate: admin.firestore.Timestamp.fromDate(startDate),
      expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});

    console.log(`Abbonamento attivato per utente ${userId}`);
  } catch (error) {
    console.error("Errore nella gestione checkout completato:", error);
  }
}

/**
 * Gestisci aggiornamento subscription
 * @param {Object} subscription
 * @param {Object} db
 * @param {Object} stripeInstance
 */
async function handleSubscriptionUpdate(subscription, db, stripeInstance) {
  const customerId = subscription.customer;

  try {
    // Trova l'utente tramite customerId
    const subscriptionsSnapshot = await db.collection("subscriptions")
        .where("stripeCustomerId", "==", customerId)
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
    const firstItem = subscription.items &&
        subscription.items.data &&
        subscription.items.data[0];
    const priceId = firstItem && firstItem.price ? firstItem.price.id : null;
    const yearlyPriceId = stripeYearlyPriceId.value();

    let planType = "monthly";
    if (priceId === yearlyPriceId) {
      planType = "yearly";
    }

    await db.collection("subscriptions").doc(userId).update({
      plan: planType,
      status: subscription.status === "active" ? "active" : "cancelled",
      expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Subscription aggiornata per utente ${userId}`);
  } catch (error) {
    console.error("Errore nella gestione aggiornamento subscription:", error);
  }
}

/**
 * Gestisci cancellazione subscription
 * @param {Object} subscription
 * @param {Object} db
 */
async function handleSubscriptionCancelled(subscription, db) {
  const customerId = subscription.customer;

  try {
    const subscriptionsSnapshot = await db.collection("subscriptions")
        .where("stripeCustomerId", "==", customerId)
        .limit(1)
        .get();

    if (subscriptionsSnapshot.empty) {
      console.log(`Nessuna subscription trovata per customer ${customerId}`);
      return;
    }

    const subscriptionDoc = subscriptionsSnapshot.docs[0];
    const userId = subscriptionDoc.id;

    await db.collection("subscriptions").doc(userId).update({
      status: "cancelled",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Subscription cancellata per utente ${userId}`);
  } catch (error) {
    console.error("Errore nella gestione cancellazione subscription:", error);
  }
}

/**
 * Gestisci pagamento riuscito
 * @param {Object} invoice
 * @param {Object} db
 * @param {Object} stripeInstance
 */
async function handlePaymentSucceeded(invoice, db, stripeInstance) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) {
    return;
  }

  try {
    const subscription = await stripeInstance.subscriptions.retrieve(
        subscriptionId);
    const customerId = subscription.customer;

    const subscriptionsSnapshot = await db.collection("subscriptions")
        .where("stripeCustomerId", "==", customerId)
        .limit(1)
        .get();

    if (subscriptionsSnapshot.empty) {
      return;
    }

    const subscriptionDoc = subscriptionsSnapshot.docs[0];
    const userId = subscriptionDoc.id;

    const expiryDate = new Date(subscription.current_period_end * 1000);

    await db.collection("subscriptions").doc(userId).update({
      status: "active",
      expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Pagamento riuscito per utente ${userId}`);
  } catch (error) {
    console.error("Errore nella gestione pagamento riuscito:", error);
  }
}

/**
 * Gestisci pagamento fallito
 * @param {Object} invoice
 * @param {Object} db
 * @param {Object} stripeInstance
 */
async function handlePaymentFailed(invoice, db, stripeInstance) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) {
    return;
  }

  try {
    const subscription = await stripeInstance.subscriptions.retrieve(
        subscriptionId);
    const customerId = subscription.customer;

    const subscriptionsSnapshot = await db.collection("subscriptions")
        .where("stripeCustomerId", "==", customerId)
        .limit(1)
        .get();

    if (subscriptionsSnapshot.empty) {
      return;
    }

    const subscriptionDoc = subscriptionsSnapshot.docs[0];
    const userId = subscriptionDoc.id;

    await db.collection("subscriptions").doc(userId).update({
      status: "past_due",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Pagamento fallito per utente ${userId}`);
  } catch (error) {
    console.error("Errore nella gestione pagamento fallito:", error);
  }
}

