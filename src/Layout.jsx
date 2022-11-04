import React, { useState } from "react";
import App from "./App.jsx";
import Loader from "./components/loader/Loader.jsx";
import SideBar from "./components/sideBar/SideBar.jsx";

function Layout() {
  const [componentLoaded, setComponentLoaded] = useState(false);

  return (
    <>
      <Loader componentLoaded={componentLoaded} />
      <SideBar />
      <App setComponentLoaded={setComponentLoaded} />
    </>
  );
}

export default Layout;
