import React from "react";
import $ from "jquery";
import "./navbarToggler.css";

function NavbarToggler() {
  const handleClickSideBarToggler = () => {
    $(".sidebar-toggler").toggleClass("active");
    $(".sidebar-toggler").toggleClass("not-active");
    let marginLeftSideBar = 0;
    //if (parseInt($("#sideBarApp").css("marginLeft").replace("px", "")) === 0) marginLeftSideBar = -250;
    //$("#sideBarApp").animate({ marginLeft: marginLeftSideBar }, 300);
    //$(".app").animate({ marginLeft: marginLeftSideBar + 250 }, 300);

    $("#sideBarApp").toggleClass("ml-0");
    $(".app").toggleClass("margin-app");
  };

  return (
    <div className="sidebar-toggler not-active" onClick={handleClickSideBarToggler}>
      <span></span>
      <span></span>
      <span></span>
    </div>
  );
}

export default NavbarToggler;
