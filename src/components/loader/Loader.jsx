import React, { useEffect, useState } from "react";
import "./loader.scss";
import logo from "../../assets/imgs/indira-logo-white-transparent.svg";
import ImgIndiraText from "../imgIndiraWithText/ImgIndiraText";

function Loader({ componentLoaded }) {
  const [loaded, setLoaded] = useState(componentLoaded);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (componentLoaded) {
      setFadeOut(true);
      setTimeout(() => {
        setLoaded(componentLoaded);
      }, 300);
    }
  }, [componentLoaded]);
  return (
    !loaded && (
      <div className={`loader-container ${fadeOut ? "fade-out" : ""}`}>
        <div className="logo-2">
          <ImgIndiraText />
        </div>
        <span className="loader"></span>
        <img src={logo} alt="Logo INDIRA" className="logo" />
        <div className="semi-ellipse lef-bottom" />
        <div className="semi-ellipse right-top" />
      </div>
    )
  );
}

export default Loader;
