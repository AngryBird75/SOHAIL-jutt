// UPDATED app.js WITH UPDATE FEATURE
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const app = express();

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/businessApp';
const port = process.env.PORT || 80;

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

const recordSchema = new mongoose.Schema({
  type: String,
  product: String,
  person: String,
  weight: Number,
  rate: Number,
  price: Number,
  time: { type: Date, default: Date.now },
  date: { type: Date, default: Date.now }
});

const moneySchema = new mongoose.Schema({
  type: String,
  person: String,
  amount: Number,
  paymentType: String,
  bankName: String,
  time: { type: Date, default: Date.now },
  date: { type: Date, default: Date.now }
});

const Record = mongoose.model('Record', recordSchema);
const Money = mongoose.model('Money', moneySchema);

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.use(session({
  secret: 'a-very-strong-secret-key-for-allah-waris-app',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

const requireLogin = (req, res, next) => {
  if (!req.session.userId) return res.redirect('/login');
  next();
};

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'Sohail Cheema' && password === 'sohail7862') {
    req.session.userId = 'sohail';
    return res.redirect('/');
  }
  res.render('login', { error: 'Invalid username or password.' });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

app.get('/', requireLogin, (req, res) => {
  res.render('dashboard');
});

app.get('/product/add', requireLogin, (req, res) => {
  res.render('product_forms');
});

app.post('/product/add', requireLogin, async (req, res) => {
  const { type, product, person, weight, rate, date } = req.body;
  const price = parseFloat(weight) * parseFloat(rate);
  await new Record({ type, product, person, weight, rate, price, date: date ? new Date(date) : new Date() }).save();
  res.redirect('/activity');
});

app.get('/product/edit/:id', requireLogin, async (req, res) => {
  const record = await Record.findById(req.params.id);
  res.render('edit_product', { record });
});

app.post('/product/edit/:id', requireLogin, async (req, res) => {
  const { type, product, person, weight, rate, date } = req.body;
  const price = parseFloat(weight) * parseFloat(rate);
  await Record.findByIdAndUpdate(req.params.id, {
    type, product, person, weight, rate, price, date: date ? new Date(date) : new Date()
  });
  res.redirect('/activity');
});

app.post('/product/delete/:id', requireLogin, async (req, res) => {
  await Record.findByIdAndDelete(req.params.id);
  res.redirect('/activity');
});

app.get('/money/add', requireLogin, (req, res) => {
  res.render('money_forms');
});

app.post('/money/add', requireLogin, async (req, res) => {
  const { type, person, amount, paymentType, bankName, date } = req.body;
  await new Money({
    type,
    person,
    amount: parseFloat(amount),
    paymentType,
    bankName: (paymentType === 'Cheque' || paymentType === 'Bank') ? bankName : '',
    date: date ? new Date(date) : new Date()
  }).save();
  res.redirect('/activity');
});

app.get('/money/edit/:id', requireLogin, async (req, res) => {
  const money = await Money.findById(req.params.id);
  res.render('edit_money', { money });
});

app.post('/money/edit/:id', requireLogin, async (req, res) => {
  const { type, person, amount, paymentType, bankName, date } = req.body;
  await Money.findByIdAndUpdate(req.params.id, {
    type, person, amount: parseFloat(amount), paymentType,
    bankName: (paymentType === 'Cheque' || paymentType === 'Bank') ? bankName : '',
    date: date ? new Date(date) : new Date()
  });
  res.redirect('/activity');
});

app.post('/money/delete/:id', requireLogin, async (req, res) => {
  await Money.findByIdAndDelete(req.params.id);
  res.redirect('/activity');
});

app.get('/search', requireLogin, async (req, res) => {
  const { person, date } = req.query;
  let dateFilter = {};
  if (date) {
    const selectedDate = new Date(date);
    const nextDay = new Date(selectedDate);
    nextDay.setDate(selectedDate.getDate() + 1);
    dateFilter = { date: { $gte: selectedDate, $lt: nextDay } };
  }

  let recordQuery = date ? { ...dateFilter } : {};
  let moneyQuery = date ? { ...dateFilter } : {};
  if (person) {
    recordQuery.person = person;
    moneyQuery.person = person;
  }

  const [allRecords, allMoney, uniqueRecords, uniqueMoney] = await Promise.all([
    Record.find(recordQuery),
    Money.find(moneyQuery),
    Record.distinct('person'),
    Money.distinct('person')
  ]);

  const allPersons = [...new Set([...uniqueRecords, ...uniqueMoney])];

  let personActivity = [...allRecords.map(r => ({
    type: r.type === 'send' ? 'Product Sent' : 'Product Received',
    detail: `${r.product} x ${r.weight}kg`,
    rate: r.rate,
    amount: r.price,
    time: r.time
  })),
  ...allMoney.map(m => ({
    type: m.type === 'send' ? '💸 Money Sent' : '💵 Money Received',
    detail: m.paymentType + (m.bankName ? ` (${m.bankName})` : ''),
    rate: '-',
    amount: m.amount,
    time: m.time
  }))].sort((a, b) => new Date(a.time) - new Date(b.time));

  let totalActivity = 0;
  personActivity.forEach(entry => {
    totalActivity += entry.type.includes('Received') ? entry.amount : -entry.amount;
    entry.runningTotal = totalActivity;
  });

  res.render('search', {
    searchPerson: person,
    searchDate: date,
    personActivity,
    totalActivity,
    allPersons
  });
});

app.get('/activity', requireLogin, async (req, res) => {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const [todayRecords, todayMoney, allRecords, allMoney] = await Promise.all([
    Record.find({ time: { $gte: todayStart, $lte: todayEnd } }).sort({ time: -1 }),
    Money.find({ time: { $gte: todayStart, $lte: todayEnd } }).sort({ time: -1 }),
    Record.find().sort({ time: -1 }),
    Money.find().sort({ time: -1 })
  ]);

  let totalReceivedPrice = 0, totalSentPrice = 0;
  const allProductRecords = await Record.find();

  allProductRecords.forEach(r => {
    if (r.type === 'receive') totalReceivedPrice += r.price;
    if (r.type === 'send') totalSentPrice += r.price;
  });

  const profit = totalSentPrice - totalReceivedPrice;
  res.render('activity', { todayRecords, todayMoney, allRecords, allMoney, profit });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});