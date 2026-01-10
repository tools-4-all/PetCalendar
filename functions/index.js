const functions = require("firebase-functions");
const {defineString, defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");

// Definisci i parametri usando il nuovo sistema params
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
// Price ID mensile: price_1SoAwIAu52HRDJcR69PmviBn
const stripeMonthlyPriceId = defineString("STRIPE_PRICE_MONTHLY_ID", {
  default: "price_1SoAwIAu52HRDJcR69PmviBn",
});
// Price ID annuale: price_1SoAwfAu52HRDJcR1lZczrAX
const stripeYearlyPriceId = defineString("STRIPE_PRICE_YEARLY_ID", {
  default: "price_1SoAwfAu52HRDJcR1lZczrAX",
});
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const appUrl = defineString("APP_URL", {default: "https://petcalendar-67853.web.app"});

// Inizializza Stripe con il secret
let stripe = null;

admin.initializeApp();

// Crea sessione checkout per abbonamento
exports.createSubscriptionCheckout = functions
    .runWith({secrets: [stripeSecretKey]})
    .https
    .onCall(async (data, context) => {
      // Verifica autenticazione
      if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated", "Devi essere autenticato");
      }

      // Inizializza Stripe se non già fatto
      if (!stripe) {
        stripe = require("stripe")(stripeSecretKey.value());
      }

      const uid = context.auth.uid;
      const email = context.auth.token.email || data.userEmail;
      const {planType} = data;

      // Prezzi in centesimi
      const monthlyPriceId = stripeMonthlyPriceId.value();
      const yearlyPriceId = stripeYearlyPriceId.value();

      console.log(`[Checkout] Piano richiesto: ${planType}`);
      console.log(`[Checkout] Monthly Price ID: ${monthlyPriceId}`);
      console.log(`[Checkout] Yearly Price ID: ${yearlyPriceId}`);

      const prices = {
        // ID prezzo mensile da Stripe Dashboard
        "monthly": monthlyPriceId,
        // ID prezzo annuale da Stripe Dashboard
        "yearly": yearlyPriceId,
      };

      const priceId = prices[planType];
      if (!priceId || priceId === "") {
        console.error(
            `[Checkout] Price ID non valido per piano ${planType}: ${priceId}`);
        throw new functions.https.HttpsError(
            "invalid-argument",
            `Piano ${planType} non configurato. Price ID mancante.`);
      }

      // Ottieni l'URL base dell'app
      const baseUrl = appUrl.value();

      const db = admin.firestore();

      try {
        // PROTEZIONE: Verifica che non sia già premium (evita doppi pagamenti)
        const userDoc = await db.collection("subscriptions").doc(uid).get();
        const userData = userDoc.data();

        if (userData?.status === "active") {
          const endDate = userData?.expiryDate?.toDate ?
                      userData.expiryDate.toDate() :
                      new Date(userData?.expiryDate);
          if (endDate > new Date()) {
            throw new functions.https.HttpsError(
                "already-exists",
                "Hai già un abbonamento attivo",
            );
          }
        }

        // Crea o recupera il customer Stripe
        let customerId;

        if (userData && userData.stripeCustomerId) {
          // Verifica che il customer esista ancora in Stripe
          try {
            await stripe.customers.retrieve(userData.stripeCustomerId);
            customerId = userData.stripeCustomerId;
          } catch (error) {
            // Se il customer non esiste (errore 404 o simile), creane uno nuovo
            if (error.code === "resource_missing" ||
            error.statusCode === 404) {
              console.warn(
                  `Customer ${userData.stripeCustomerId} non trovato, ` +
              "ne creo uno nuovo");
              // Rimuovi il customer ID invalido dal database
              await db.collection("subscriptions").doc(uid).update({
                stripeCustomerId: admin.firestore.FieldValue.delete(),
              });
              // Crea un nuovo customer
              const customer = await stripe.customers.create({
                email: email,
                metadata: {
                  firebaseUID: uid,
                },
              });
              customerId = customer.id;

              // Salva il nuovo customer ID nel profilo utente
              await db.collection("subscriptions").doc(uid).set({
                stripeCustomerId: customerId,
              }, {merge: true});
            } else {
              // Se è un altro tipo di errore, rilancialo
              throw error;
            }
          }
        } else {
          // Crea un nuovo customer
          const customer = await stripe.customers.create({
            email: email,
            metadata: {
              firebaseUID: uid,
            },
          });
          customerId = customer.id;

          // Salva il customer ID nel profilo utente
          await db.collection("subscriptions").doc(uid).set({
            stripeCustomerId: customerId,
          }, {merge: true});
        }

        // Crea sessione checkout
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: "subscription",
          payment_method_types: ["card"],
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
            firebaseUID: uid,
            planType: planType,
          },
          subscription_data: {
            metadata: {
              firebaseUID: uid,
            },
          },
        });

        console.log(
            `[Checkout] Sessione creata con successo: ${session.id}`);
        return {url: session.url, sessionId: session.id};
      } catch (error) {
        console.error("[Checkout] Errore creazione checkout:", error);
        console.error("[Checkout] Stack:", error.stack);
        console.error("[Checkout] Dettagli:", {
          message: error.message,
          type: error.type,
          code: error.code,
          statusCode: error.statusCode,
        });
        throw new functions.https.HttpsError(
            "internal",
            `Errore nella creazione del checkout: ${error.message}`);
      }
    });

// Webhook per gestire eventi Stripe
exports.stripeWebhook = functions
    .runWith({secrets: [stripeSecretKey, stripeWebhookSecret]})
    .https
    .onRequest(async (req, res) => {
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
  const uid = session.metadata && session.metadata.firebaseUID;
  if (!uid) {
    console.error("UID non trovato nel metadata della sessione");
    return;
  }

  // IMPORTANTE: Verifica che il pagamento sia stato completato
  if (session.payment_status !== "paid") {
    console.warn(
        `Checkout completato ma pagamento non completato per utente ` +
        `${uid}. Payment status: ${session.payment_status}`);
    return;
  }

  const subscriptionId = session.subscription;
  const customerId = session.customer;

  if (!subscriptionId) {
    console.error("Subscription ID non trovato nella sessione");
    return;
  }

  try {
    // Recupera i dettagli della subscription
    const subscription = await stripeInstance.subscriptions.retrieve(
        subscriptionId);

    // Verifica che la subscription sia attiva
    if (subscription.status !== "active" &&
        subscription.status !== "trialing") {
      console.warn(
          `Subscription non attiva per utente ${uid}. ` +
          `Status: ${subscription.status}`);
      return;
    }

    const currentPeriodEnd =
        new Date(subscription.current_period_end * 1000);
    const currentPeriodStart =
        new Date(subscription.current_period_start * 1000);

    // Aggiorna abbonamento nel database
    const interval =
        subscription.items.data[0].price.recurring?.interval;
    await db.collection("subscriptions").doc(uid).set({
      plan: interval === "year" ? "yearly" : "monthly",
      status: "active",
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      startDate: admin.firestore.Timestamp.fromDate(currentPeriodStart),
      expiryDate: admin.firestore.Timestamp.fromDate(currentPeriodEnd),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});

    console.log(`Abbonamento attivato per utente ${uid}`);
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
  const uid = subscription.metadata && subscription.metadata.firebaseUID;
  if (!uid) {
    console.error("UID non trovato nel metadata della subscription");
    return;
  }

  try {
    const currentPeriodEnd =
        new Date(subscription.current_period_end * 1000);
    const currentPeriodStart =
        new Date(subscription.current_period_start * 1000);

    // Determina il tipo di piano dal price ID
    const firstItem = subscription.items &&
        subscription.items.data &&
        subscription.items.data[0];
    const priceId = firstItem && firstItem.price ?
        firstItem.price.id : null;
    const yearlyPriceId = stripeYearlyPriceId.value();

    let planType = "monthly";
    if (priceId === yearlyPriceId) {
      planType = "yearly";
    }

    // Determina lo status: se cancel_at_period_end è true,
    // considera come 'cancelled' ma mantiene endDate
    let status = subscription.status;
    if (subscription.cancel_at_period_end === true) {
      // Anche se status è ancora 'active',
      // lo trattiamo come 'cancelled'
      status = "cancelled";
    } else if (subscription.status === "active") {
      status = "active";
    } else {
      status = "cancelled";
    }

    await db.collection("subscriptions").doc(uid).set({
      plan: planType,
      status: status,
      // Sempre aggiorna endDate
      expiryDate: admin.firestore.Timestamp.fromDate(currentPeriodEnd),
      startDate: admin.firestore.Timestamp.fromDate(currentPeriodStart),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});

    console.log(
        `Subscription aggiornata per utente ${uid}: ` +
        `status=${status}, ` +
        `cancel_at_period_end=${subscription.cancel_at_period_end}, ` +
        `endDate=${currentPeriodEnd.toISOString()}`);
  } catch (error) {
    console.error("Errore nella gestione aggiornamento subscription:", error);
  }
}

/**
 * Gestisci cancellazione subscription
 * IMPORTANTE: Non modifica endDate per permettere l'uso
 * fino alla fine del periodo pagato
 * @param {Object} subscription
 * @param {Object} db
 */
async function handleSubscriptionCancelled(subscription, db) {
  const uid = subscription.metadata &&
      subscription.metadata.firebaseUID;
  if (!uid) {
    console.error(
        "UID non trovato nel metadata della subscription");
    return;
  }

  try {
    // Recupera il profilo esistente per preservare endDate
    const subscriptionDoc = await db.collection("subscriptions").doc(uid).get();
    const existingData = subscriptionDoc.exists ? subscriptionDoc.data() : null;
    const existingEndDate = existingData?.expiryDate;

    // Se endDate esiste ed è nel futuro, preservalo.
    // Altrimenti usa current_period_end se disponibile
    let endDateToKeep = existingEndDate;
    if (subscription.current_period_end) {
      const currentPeriodEnd =
          new Date(subscription.current_period_end * 1000);
      const existingEndDateValue = existingEndDate?.toDate ?
          existingEndDate.toDate() :
          new Date(existingEndDate);

      // Usa la data più lontana tra quella esistente e current_period_end
      if (!existingEndDate || currentPeriodEnd > existingEndDateValue) {
        endDateToKeep = admin.firestore.Timestamp.fromDate(currentPeriodEnd);
      }
    }

    const updateData = {
      status: "cancelled",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Preserva endDate solo se esiste ed è valido
    if (endDateToKeep) {
      updateData.expiryDate = endDateToKeep;
    }

    await db.collection("subscriptions").doc(uid).update(updateData);

    console.log(
        `Subscription cancellata per utente ${uid}. ` +
        `EndDate preservato: ${endDateToKeep ? "sì" : "no"}`);
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

  // Verifica che l'invoice sia pagato
  if (invoice.paid !== true) {
    console.warn(`Invoice non pagato: ${invoice.id}`);
    return;
  }

  try {
    const subscription = await stripeInstance.subscriptions.retrieve(
        subscriptionId);
    const uid = subscription.metadata && subscription.metadata.firebaseUID;
    if (!uid) {
      return;
    }

    // Verifica che la subscription sia ancora attiva
    if (subscription.status !== "active" &&
        subscription.status !== "trialing") {
      console.warn(
          `Subscription non attiva per utente ${uid}. ` +
          `Status: ${subscription.status}`);
      return;
    }

    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    await db.collection("subscriptions").doc(uid).update({
      status: "active",
      expiryDate: admin.firestore.Timestamp.fromDate(currentPeriodEnd),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Pagamento riuscito e verificato per utente ${uid}`);
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
    const uid = subscription.metadata && subscription.metadata.firebaseUID;
    if (!uid) {
      return;
    }

    // Non cancelliamo subito, Stripe proverà a riscuotere di nuovo
    // Possiamo inviare una notifica all'utente
    await db.collection("subscriptions").doc(uid).update({
      status: "past_due",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Pagamento fallito per utente ${uid}`);
    // TODO: Invia email di notifica all'utente
  } catch (error) {
    console.error("Errore nella gestione pagamento fallito:", error);
  }
}

