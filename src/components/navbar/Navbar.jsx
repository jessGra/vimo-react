import React, { useEffect } from "react";
import "./navbar.css";
import $ from "jquery";
import NavbarToggler from "../navbarToggler/NavbarToggler.jsx";

function Navbar() {
  const toggleConfigDrop = () => {
    $("#configDrop").fadeToggle(200);
  };

  const hideConfigDrop = (event) => {
    if (event.target.matches("#dropConfigIcon") || event.target.matches(".nav-dropdown-btn")) return;
    $("#configDrop").fadeOut(200);
  };

  useEffect(() => {
    // Close the dropdown if the user clicks outside of it
    document.addEventListener("click", hideConfigDrop, true);
    return () => {
      document.removeEventListener("click", hideConfigDrop, true);
    };
  }, []);

  return (
    <div className="navbar-indira">
      <div style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>
        <ul className="h-100 nav-list">
          <li className="h-100 d-flex align-items-center nav-list-item">
            <NavbarToggler />
          </li>
        </ul>
      </div>
      <div>
        <div className="nav-dropdown">
          <button className="nav-dropdown-btn" onClick={toggleConfigDrop}>
            <i className="bi bi-gear" id="dropConfigIcon"></i>
          </button>
          <div className="nav-dropdown-content" id="configDrop">
            <div className="mediapipe-controls-panel"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Navbar;
