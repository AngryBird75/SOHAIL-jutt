const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const app = express();

// CORRECT PORT DECLARATION (ONLY ONE)
const port = process.env.PORT || 80;

// --- DATABASE CONNECTION ---
// Use the local database for now. We will replace this with the cloud URI when deploying.
const dbURI = 'mongodb://localhost:27017/businessApp';

// CORRECT DATABASE CONNECTION (NO DEPRECATED OPTIONS)
mongoose.connect(dbURI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));


// --- SCHEMAS (No changes here) ---
const recordSchema = new mongoose.Schema({
  type: String, // 'receive', 'send'
  product: String,
  person: String,
  weight: Number,
  rate: Number,
  price: Number,
  time: { type: Date, default: Date.now },
});

const moneySchema = new mongoose.Schema({
  type: String, // 'send' or 'receive'
  person: String,
  amount: Number,
  paymentType: String, // 'Cash', 'Cheque', 'Bank'
  bankName: String,
  time: { type: Date, default: Date.now },
});

const Record = mongoose.model('Record', recordSchema);
const Money = mongoose.model('Money', moneySchema);

// --- MIDDLEWARE SETUP ---
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Session Configuration
app.use(session({
  secret: 'a-very-strong-secret-key-for-allah-waris-app',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// Middleware to protect routes
const requireLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
};

// --- AUTHENTICATION ROUTES ---
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'sohail' && password === 'sohail7862') {
    req.session.userId = 'sohail';
    res.redirect('/');
  } else {
    res.render('login', { error: 'Invalid username or password.' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.redirect('/');
    }
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});


// --- APPLICATION ROUTES (PROTECTED) ---

// Dashboard / Welcome Page
app.get('/', requireLogin, (req, res) => {
  res.render('dashboard');
});

// Search Person Page
app.get('/search', requireLogin, async (req, res) => {
  const personName = req.query.person;
  let personActivity = [];
  let totalActivity = 0;

  if (personName) {
    const allRecords = await Record.find({ person: personName });
    const allMoney = await Money.find({ person: personName });

    personActivity = [
      ...allRecords.map(r => ({
        type: r.type === 'send' ? 'Product Sent' : 'Product Received', detail: `${r.product} x ${r.weight}kg`, rate: r.rate, amount: r.price, time: r.time
      })),
      ...allMoney.map(m => {
        let label = m.paymentType;
        if ((m.paymentType === 'Cheque' || m.paymentType === 'Bank') && m.bankName) {
          label += ` (${m.bankName})`;
        }
        return { type: m.type === 'send' ? '💸 Money Sent' : '💵 Money Received', detail: label, rate: '-', amount: m.amount, time: m.time };
      })
    ].sort((a, b) => new Date(a.time) - new Date(b.time));

    personActivity.forEach(entry => {
      totalActivity += (entry.type.includes('Received')) ? entry.amount : -entry.amount;
      entry.runningTotal = totalActivity;
    });
  }
  res.render('search', { searchPerson: personName, personActivity, totalActivity });
});


// Page to show forms for adding products
app.get('/product/add', requireLogin, (req, res) => {
    res.render('product_forms');
});

// Handle adding a product record
app.post('/product/add', requireLogin, async (req, res) => {
  const { type, product, person, weight, rate } = req.body;
  const price = parseFloat(weight) * parseFloat(rate);

  const newRecord = new Record({ type, product, person, weight, rate, price });
  await newRecord.save();
  res.redirect('/activity');
});

// Page to show forms for money transactions
app.get('/money/add', requireLogin, (req, res) => {
    res.render('money_forms');
});

// Handle adding a money transaction
app.post('/money/add', requireLogin, async (req, res) => {
  const { type, person, amount, paymentType, bankName } = req.body;
  const moneyEntry = new Money({
    type, person, amount: parseFloat(amount), paymentType,
    bankName: (paymentType === 'Cheque' || paymentType === 'Bank') ? bankName : '',
  });
  await moneyEntry.save();
  res.redirect('/activity');
});

// Activity Log Page (Today & All Time)
app.get('/activity', requireLogin, async (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayRecords = await Record.find({ time: { $gte: todayStart, $lte: todayEnd } }).sort({ time: -1 });
  const todayMoney = await Money.find({ time: { $gte: todayStart, $lte: todayEnd } }).sort({ time: -1 });

  const allRecords = await Record.find().sort({ time: -1 });
  const allMoney = await Money.find().sort({ time: -1 });
  
  let totalReceivedPrice = 0;
  let totalSentPrice = 0;
  const allProductRecords = await Record.find();
  allProductRecords.forEach(r => {
      if (r.type === 'receive') totalReceivedPrice += r.price;
      if (r.type === 'send') totalSentPrice += r.price;
  });
  const profit = totalSentPrice - totalReceivedPrice;

  res.render('activity', { todayRecords, todayMoney, allRecords, allMoney, profit });
});


// --- START SERVER ---
app.listen(80, '0.0.0.0');
