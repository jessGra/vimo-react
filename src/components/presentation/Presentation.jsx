import React from "react";
import ImgIndiraText from "../imgIndiraWithText/ImgIndiraText";
import "./presentation.css";

function Presentation({ clickStart }) {
  return (
    <div className="presentation container w-75">
      <ImgIndiraText />
      <h1 className="title">Video monitoring of vital sings</h1>
      <p>
        The <b>Video monitoring of vital signs</b> is a Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris
        et convallis augue, non elementum erat. Maecenas varius dapibus felis et condimentum. Nullam rhoncus mi et risus
        elementum, vitae volutpat lorem pharetra. Quisque magna magna, convallis vel porttitor non, imperdiet vel enim.
        Sed et metus mauris. In fringilla eleifend tortor. Proin tincidunt quam ex, eget ornare nisl pretium nec.
        Integer ac finibus nulla, quis pretium tortor. Maecenas ligula velit, accumsan vitae fermentum placerat,
        pellentesque et magna. Nunc cursus porta nisi quis bibendum. Donec vitae massa tincidunt erat interdum vehicula
        vitae et magna.
      </p>
      <a className="btn-start" onClick={clickStart}>
        <i className="bi bi-activity"></i> Start
      </a>
    </div>
  );
}

export default Presentation;
