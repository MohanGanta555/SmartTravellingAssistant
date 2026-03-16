import React from "react";

function Landing() {
  const bg = `${process.env.PUBLIC_URL || ""}/cover_image.jpg`;
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        backgroundImage: `url('${bg}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(37, 235, 235, 0.35) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.2) 100%)",
          pointerEvents: "none"
        }}
      />
    </div>
  );
}

export default Landing;
