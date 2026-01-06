const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID_HERE',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET_HERE',
      callbackURL: '/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const existingUser = await User.findOne({ googleId: profile.id });
        if (existingUser) {
          // Agar avval avatar saqlanmagan bo'lsa, Google profil rasmini yangilab qo'yamiz
          const photoUrl =
            (profile.photos && profile.photos[0] && profile.photos[0].value) ||
            (profile._json && profile._json.picture) ||
            undefined;
          if (!existingUser.avatar && photoUrl) {
            existingUser.avatar = photoUrl;
            await existingUser.save();
          }
          return done(null, existingUser);
        }

        const photoUrl =
          (profile.photos && profile.photos[0] && profile.photos[0].value) ||
          (profile._json && profile._json.picture) ||
          undefined;

        const user = await User.create({
          name: profile.displayName,
          email: profile.emails && profile.emails[0] ? profile.emails[0].value : undefined,
          googleId: profile.id,
          avatar: photoUrl
        });

        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);
