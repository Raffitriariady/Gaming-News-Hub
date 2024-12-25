document.addEventListener("DOMContentLoaded", () => {
  const profilePopup = document.getElementById("profilePopup");
  const logoutButton = document.getElementById("logoutButton");
  const uploadForm = document.getElementById("uploadForm");

  // Toggle pop-up visibility
  window.toggleProfilePopup = () => {
    if (profilePopup) {
      profilePopup.style.display =
        profilePopup.style.display === "none" ? "block" : "none";
    }
  };

  // Hide popup when clicking outside
  document.addEventListener("click", (e) => {
    const profileImage = document.getElementById("profileImage");
    if (
      profilePopup.style.display === "block" &&
      !profilePopup.contains(e.target) &&
      !profileImage.contains(e.target)
    ) {
      profilePopup.style.display = "none";
    }
  });

  // Logout function
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        const response = await fetch("/logout", { method: "POST" });
        if (response.ok) {
          alert("Logged out successfully!");
          window.location.href = "/login"; // Redirect to login page
        } else {
          alert("Error logging out");
        }
      } catch (error) {
        console.error("Logout error:", error);
      }
    });
  }

  // Ganti gambar profil setelah upload
  if (uploadForm) {
    uploadForm.addEventListener("submit", (event) => {
      event.preventDefault(); // Prevent page reload

      const formData = new FormData(uploadForm);
      fetch(uploadForm.action, {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.profilePicture) {
            document.getElementById("profilePic").src = data.profilePicture; // Update gambar profil
          }
        })
        .catch((err) => console.error("Error uploading profile picture:", err));
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".reaction-button").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const form = button.closest(".reaction-form");
      const commentId = form.querySelector('[name="comment_id"]').value;
      const reaction = button.dataset.reaction;

      try {
        const response = await fetch("/api/comment/reaction", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            comment_id: commentId,
            reaction,
          }),
        });

        const data = await response.json();
        if (data.success) {
          const likeButton = form.querySelector(".like-button");
          const dislikeButton = form.querySelector(".dislike-button");

          // Update counts
          form.querySelector(".like-count").textContent = data.likes;
          form.querySelector(".dislike-count").textContent = data.dislikes;

          // Check for active state
          if (reaction === "like") {
            if (likeButton.classList.contains("active")) {
              // User is removing the "like"
              likeButton.classList.remove("active");
            } else {
              // User is adding a "like"
              likeButton.classList.add("active");
              dislikeButton.classList.remove("active");
            }
          } else if (reaction === "dislike") {
            if (dislikeButton.classList.contains("active")) {
              // User is removing the "dislike"
              dislikeButton.classList.remove("active");
            } else {
              // User is adding a "dislike"
              dislikeButton.classList.add("active");
              likeButton.classList.remove("active");
            }
          }
        } else {
          alert(data.error || "An error occurred.");
        }
      } catch (error) {
        console.error("Error reacting to comment:", error);
        alert("Something went wrong. Please try again.");
      }
    });
  });
});

// swiper
new Swiper(".card-wrapper:not(.sub-card-wrapper)", {
  loop: true,
  spaceBetween: 30,
  pagination: {
    el: ".swiper-pagination",
    clickable: true,
    dynamicBullets: true,
  },
  navigation: {
    nextEl: ".swiper-button-next",
    prevEl: ".swiper-button-prev",
  },
  breakpoints: {
    0: {
      slidesPerView: 1,
    },
    768: {
      slidesPerView: 2,
    },
    1024: {
      slidesPerView: 3,
    },
  },
});

// Swiper untuk sub-carousel (5 articles per view)
new Swiper(".sub-card-wrapper", {
  loop: true,
  spaceBetween: 30,
  pagination: {
    el: ".swiper-pagination",
    clickable: true,
    dynamicBullets: true,
  },
  navigation: {
    nextEl: ".swiper-button-next",
    prevEl: ".swiper-button-prev",
  },
  breakpoints: {
    0: {
      slidesPerView: 2,
    },
    768: {
      slidesPerView: 3,
    },
    1024: {
      slidesPerView: 5,
    },
  },
});

function searchArticles() {
  const input = document.getElementById("searchInput").value.toLowerCase();
  const articles = document
    .getElementById("articleList")
    .getElementsByTagName("article");

  for (let i = 0; i < articles.length; i++) {
    const title = articles[i].getElementsByTagName("h2")[0];
    if (title.innerHTML.toLowerCase().includes(input)) {
      articles[i].style.display = "";
    } else {
      articles[i].style.display = "none";
    }
  }
}
