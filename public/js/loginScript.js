const backendUrl = "http://localhost:3000"; // Ganti dengan URL backend-mu jika berbeda

// Login
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;

  try {
    const response = await fetch(`${backendUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const message = await response.text();
    if (response.ok) {
      alert("Login successful!");
      window.location.href = "/";
    } else {
      document.getElementById("loginMessage").innerText = message;
    }
  } catch (error) {
    document.getElementById("loginMessage").innerText = "Something went wrong!";
  }
});

// Signup
document
  .getElementById("registerForm")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("signupUsername").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("signupPassword").value;

    try {
      const response = await fetch(`${backendUrl}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const message = await response.text();
      if (response.ok) {
        alert("Registration successful! Please login.");
        window.location.href = "/login";
      } else {
        document.getElementById("signupMessage").innerText = message;
      }
    } catch (error) {
      document.getElementById("signupMessage").innerText =
        "Something went wrong!";
    }
  });
