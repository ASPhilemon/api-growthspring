// middleware.js
import express from "express";
import cors from "cors";
import * as Errors from "./utils/error-util.js";
import * as Response from "./utils/http-response-util.js";
import { verifyJWT } from "./services/auth-service/service.js";
import cookieParser from "cookie-parser";

export function registerBeforeAllMiddleware(app) {
  app.use(
    cors({
      // Make sure this matches your actual frontend port(s)
      origin: ["http://localhost:3000", "http://localhost:4000", "https://dash.growthspringers.com", "https://auth.growthspringers.com"],
      credentials: true,
    })
  );
  app.use(express.static("public"));
  app.use(cookieParser());
  app.use(express.json());
  app.use((req, res, next) => {
    req.body = req.body ? req.body : {};
    next();
  });

  app.use(getUser); // attaches req.user if a valid JWT is present
}

export function registerAfterAllMiddleware(app) {
  app.use(errorHandler);
}

export function getUser(req, res, next) {
  let user = null;

  try {
    // 1) Try cookie first
    let jwt = req.cookies?.jwt;

    // 2) Fallback to Authorization header (Bearer <token>)
    if (!jwt) {
      const auth = req.get("authorization") || req.get("Authorization");
      if (auth && auth.startsWith("Bearer ")) {
        jwt = auth.slice(7).trim();
      }
    }

    // 3) (Optional) Fallback to query param for debugging: ?token=...
    if (!jwt && req.query?.token) {
      jwt = req.query.token;
    }

    if (jwt) {
      user = verifyJWT(jwt); // throws if invalid
    }
  } catch (err) {
    user = null; // invalid token => unauthenticated
  }

  req.user = user;
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) {
    throw new Errors.NotAuthenticatedError();
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) throw new Errors.NotAuthenticatedError();
  if (!req.user.isAdmin) throw new Errors.NotAllowedError();
  next();
}

export function errorHandler(err, req, res, next) {
  const isAppError = err instanceof Errors.AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const errMessage = isAppError ? err.message : "Sorry, an unknown error occured";
  Response.sendError(errMessage, statusCode, { req, res });

  const NODE_ENV = process.env.NODE_ENV;
  if (["debug", "debug-mongoose"].includes(NODE_ENV)) {
    console.error(err);
  }
}
