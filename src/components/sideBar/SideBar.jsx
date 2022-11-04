import React from "react";
import "./sidebar.css";
import NavbarToggler from "../navbarToggler/NavbarToggler.jsx";
import ImgIndiraText from "../imgIndiraWithText/ImgIndiraText.jsx";

function SideBar() {
  const handleClickInicio = () => {
    window.location.reload();
  };
  return (
    <div id="sideBarApp" className="sidebar">
      <div className="items-sidebar">
        <NavbarToggler />
        <ul className="nav-list">
          <li onClick={handleClickInicio}>Inicio</li>
          <li>Historial</li>
          <li>Acerca de</li>
        </ul>
      </div>
      <ImgIndiraText />
    </div>
  );
}

export default SideBar;
