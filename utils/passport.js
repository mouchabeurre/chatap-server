const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const user_model = require('../models/user');
const secret = require('./config').secret;

module.exports = function (passport) {
	let opts = {};
	opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
	opts.secretOrKey = process.env.SECRET || secret;
	passport.use(new JwtStrategy(opts, (jwt_payload, done) => {
		user_model.getUser(jwt_payload.userIdentity, { username: 1 })
			.then((user) => {
				if (!user) {
					return done(null, false);
				} else {
					return done(null, user.toObject());
				}
			})
			.catch((error) => {
				return done(error, false);
			});
	}));
}
