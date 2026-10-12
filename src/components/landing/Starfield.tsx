/**
 * Starfield background layer.
 * Pure CSS using layered radial-gradients for tiny white dots.
 * No JavaScript, respects prefers-reduced-motion via globals.css.
 * Absolutely positioned, low opacity, pointer-events-none.
 */
export default function Starfield() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        backgroundImage: [
          // Layer 1: small sparse stars
          "radial-gradient(1px 1px at 20px 30px, rgba(255,255,255,0.7), transparent)",
          "radial-gradient(1px 1px at 120px 80px, rgba(255,255,255,0.5), transparent)",
          "radial-gradient(1px 1px at 200px 150px, rgba(255,255,255,0.8), transparent)",
          "radial-gradient(1.5px 1.5px at 320px 60px, rgba(255,255,255,0.6), transparent)",
          "radial-gradient(1px 1px at 400px 200px, rgba(255,255,255,0.7), transparent)",
          "radial-gradient(1px 1px at 500px 120px, rgba(255,255,255,0.5), transparent)",
          // Layer 2: medium stars
          "radial-gradient(2px 2px at 80px 250px, rgba(255,255,255,0.4), transparent)",
          "radial-gradient(2px 2px at 260px 320px, rgba(255,255,255,0.5), transparent)",
          "radial-gradient(1.5px 1.5px at 450px 280px, rgba(255,255,255,0.6), transparent)",
        ].join(", "),
        backgroundRepeat: "repeat",
        backgroundSize: "550px 400px",
        opacity: 0.6,
      }}
    />
  );
}
