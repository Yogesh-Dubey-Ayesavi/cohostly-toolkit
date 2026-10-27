package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// The platform gives every app PLATFORM_AUTH_URL. It is the token's issuer, and its signing keys are published at /.well-known/jwks.json.
var authURL = strings.TrimRight(os.Getenv("PLATFORM_AUTH_URL"), "/")

const leeway = 30 * time.Second

// Context is the request context in the groups the platform sends.
type Context map[string]map[string]any

func (c Context) field(group, name string) string {
	s, _ := c[group][name].(string)
	return s
}

type ctxKey struct{}

// keyCache holds the platform's public keys by kid and refetches at most every 10 seconds when it meets one it does not know.
type keyCache struct {
	mu      sync.Mutex
	keys    map[string]*ecdsa.PublicKey
	fetched time.Time
}

var cache = &keyCache{}

func (k *keyCache) get(kid string) (*ecdsa.PublicKey, error) {
	k.mu.Lock()
	defer k.mu.Unlock()
	if key, ok := k.keys[kid]; ok && time.Since(k.fetched) < time.Hour {
		return key, nil
	}
	if time.Since(k.fetched) < 10*time.Second && k.keys != nil {
		return nil, errors.New("unknown key")
	}
	resp, err := http.Get(authURL + "/.well-known/jwks.json")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var doc struct {
		Keys []struct{ Kty, Crv, Kid, X, Y string } `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return nil, err
	}
	next := map[string]*ecdsa.PublicKey{}
	for _, j := range doc.Keys {
		if j.Kty != "EC" || j.Crv != "P-256" || j.Kid == "" {
			continue
		}
		x, _ := base64.RawURLEncoding.DecodeString(j.X)
		y, _ := base64.RawURLEncoding.DecodeString(j.Y)
		next[j.Kid] = &ecdsa.PublicKey{Curve: elliptic.P256(), X: new(big.Int).SetBytes(x), Y: new(big.Int).SetBytes(y)}
	}
	k.keys, k.fetched = next, time.Now()
	if key, ok := next[kid]; ok {
		return key, nil
	}
	return nil, errors.New("unknown key")
}

// verify checks an ES256 token: the signature by kid, the lifetime, the issuer and that it was issued for this host.
func verify(token, host string, now time.Time) (Context, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("not a token")
	}
	var header struct{ Alg, Kid string }
	var claims struct {
		Iss, Aud string
		Exp, Iat int64
		Ctx      Context
	}
	for i, dst := range []any{&header, &claims} {
		raw, err := base64.RawURLEncoding.DecodeString(parts[i])
		if err != nil || json.Unmarshal(raw, dst) != nil {
			return nil, errors.New("not a token")
		}
	}
	if header.Alg != "ES256" { // never "none", never a shared-secret algorithm
		return nil, errors.New("the token must be signed with ES256")
	}
	key, err := cache.get(header.Kid)
	if err != nil {
		return nil, err
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || len(sig) != 64 {
		return nil, errors.New("bad signature")
	}
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if !ecdsa.Verify(key, digest[:], new(big.Int).SetBytes(sig[:32]), new(big.Int).SetBytes(sig[32:])) {
		return nil, errors.New("the signature does not verify")
	}
	if time.Unix(claims.Exp, 0).Add(leeway).Before(now) {
		return nil, errors.New("the token has expired")
	}
	if time.Unix(claims.Iat, 0).Add(-leeway).After(now) {
		return nil, errors.New("the token is from the future")
	}
	if claims.Iss != authURL {
		return nil, errors.New("the token was issued by a different platform")
	}
	if claims.Aud != strings.ToLower(host) {
		return nil, errors.New("the token is for a different app")
	}
	return claims.Ctx, nil
}

// requirePlatform verifies the signed context and puts it on the request, or answers 401.
func requirePlatform(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("X-Platform-Context")
		host := r.Header.Get("X-Forwarded-Host")
		if host == "" {
			host = r.Host
		}
		ctx, err := verify(token, host, time.Now())
		if token == "" || err != nil {
			http.Error(w, "The platform's context for this request could not be verified.", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, ctx)))
	})
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte(`{"ok":true}`)) })
	mux.Handle("/me", requirePlatform(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context().Value(ctxKey{}).(Context)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"kind": ctx.field("caller", "kind"), "id": ctx.field("caller", "id"), "role": ctx.field("access", "role")})
	})))
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	http.ListenAndServe(":"+port, mux)
}
