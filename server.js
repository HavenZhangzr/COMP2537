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
app.set('view engine', 'ejs');

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
        res.render('home',{username: null});
    } else {
        res.render('home',{username: req.session.username, 
            user_type: req.session.user_type});
    }
});

function isValidSession(req) {
    return req.session.authenticated;
}

function sessionValidation(req, res, next) {
    if (isValidSession(req)) {
        next();
    } else {
        res.redirect('/login');
    }
}

function isAdmin(req) {
    return req.session.user_type === 'admin';
}

function adminAuthorization(req, res, next) {
    if (!isAdmin(req)) {
        res.status(403);
        res.render('403');
    } else {
        next();
    }
}

// signup GET
app.get('/signup', (req, res) => {
    res.render('signup');
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
    await userCollection.insertOne({ name, email, password: hashed, user_type: "user" });

    req.session.authenticated = true;
    req.session.username = name;
    req.session.cookie.maxAge = expireTime;

    res.redirect('/');
});

// login GET
app.get('/login', (req, res) => {
    res.render('login');
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
    req.session.user_type = user.user_type;
    req.session.cookie.maxAge = expireTime;
    res.redirect('/members');
});

// promote user 
app.get('/promote/:username', async (req, res) => {
    await userCollection.updateOne(
        { name: req.params.username },
        { $set: { user_type: 'admin' } }
    );
    res.redirect('/admin');
});

app.get('/demote/:username', async (req, res) => {
    await userCollection.updateOne(
        { name: req.params.username },
        { $set: { user_type: 'user' } }
    );
    res.redirect('/admin');
});

// admin page
app.get('/admin', sessionValidation, adminAuthorization, async (req, res) => {
    const users = await userCollection.find().toArray();
    res.render('admin', { users });
});

// members page
app.get('/members', sessionValidation, (req, res) => {
    const images = ['pic1.png', 'pic2.png', 'pic3.png'];
    res.render('members', {username: req.session.username, images});
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
    res.render("404");
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
