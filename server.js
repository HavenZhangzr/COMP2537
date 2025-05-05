require("./utils.js");

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const saltRounds = 12;
const port = process.env.PORT || 3000;
const app = express();
const Joi = require('joi');
const expireTime = 60 * 60 * 1000; //1 hour

/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */

var { database } = include('databaseConnection');

const userCollection = database.db(mongodb_database).collection('users');

app.use(express.urlencoded({extended: false}));

var mongoStore = MongoStore.create({
	mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`,
	crypto: {
		secret: mongodb_session_secret
	}
})

app.use(session({
    secret: node_session_secret,
    store: mongoStore,
    saveUninitialized: false,
    resave: false,
    cookie: { maxAge: 60 * 60 * 1000 }
}));

// Routes
// home page request
app.get('/', (req, res) => {
    if (!req.session.authenticated) {
        res.send(`
  <h1>Welcome</h1>
  <a href="/signup">Sign Up</a> | <a href="/login">Log In</a>
`);
    } else {
        res.send(`
  <h1>Hello, ${req.session.username}</h1>
  <a href="/members">Go to Members Area</a> | <a href="/logout">Logout</a>
`);
    }
});

// signup GET
app.get('/signup', (req, res) => {
    res.send(`
  <h1>Sign Up</h1>
  Create user
    <form action='/signup' method='post'>
    <input name='name' type='text' placeholder='username'><br>
    <input name='email' type='text' placeholder='email'><br>
    <input name='password' type='password' placeholder='password'><br>
    <button>Submit</button>
    </form>
`);
});

// signup POST
app.post('/signup', async (req, res) => {
    const schema = Joi.object({
        name: Joi.string().alphanum().max(20).required(),
        email: Joi.string().email().required(),
        password: Joi.string().max(20).required(),
    });
    const validation = schema.validate(req.body);
    if (validation.error) {
        return res.send(`${validation.error.message}<br><a href="/signup">Try again</a>`);
    }
    const { name, email, password } = req.body;
    const hashed = await bcrypt.hash(password, saltRounds);
    await userCollection.insertOne({ name, email, password: hashed });

    req.session.authenticated = true;
    req.session.username = name;
    req.session.cookie.maxAge = expireTime;

    res.redirect('/');
});

// login GET
app.get('/login', (req, res) => {
    res.send(`
  <h1>Login</h1>
  <form method="post" action="/login">
    <input name='email' type='text' placeholder='email'><br>
    <input name='password' type='password' placeholder='password'><br>
    <button type="submit">Submit</button>
  </form>`);
});

// login POST
app.post('/login', async (req, res) => {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().max(20).required(),
    });
    const validation = schema.validate(req.body);
    if (validation.error) {
        return res.send(`${validation.error.message}<br><a href="/login">Try again</a>`);
    }

    const { email, password } = req.body;
    const user = await userCollection.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.send(`
    User and password not found.<br>
    <a href='/login'>Try again</a>`);
    }
    req.session.authenticated = true;
    req.session.username = user.name;
    req.session.cookie.maxAge = expireTime;
    res.redirect('/members');
});

// members page
app.get('/members', (req, res) => {
    if (!req.session.authenticated) {
        return res.redirect('/');
    }
    const images = ['pic1.png', 'pic2.png', 'pic3.png'];
    const randomImage = images[Math.floor(Math.random() * images.length)];
    res.send(`
  <h1>Hello, ${req.session.username}</h1>
  <img src="/${randomImage}" width="300"><br>
  <a href="/logout">Logout</a>`);
});

// logout page
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.use(express.static(__dirname + "/public"));

app.get("*", (req,res) => {
	res.status(404);
	res.send("Page not found - 404");
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
