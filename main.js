  const homeArrow = document.getElementById("home-arrow");

  window.addEventListener("scroll", function() {
    let offset = window.scrollY;

    if(offset > 1000){
      homeArrow.style.display = "block";
    }else{
      homeArrow.style.display = "none";
    }
  })

  function showTime(){
      var date = new Date();
      var h = date.getHours(); 
      var m = date.getMinutes(); 
      var s = date.getSeconds(); 
      var session = "AM";
      
      if(h == 0){
          h = 12;
      }
      
      if(h > 12){
          h = h - 12;
          session = "PM";
      }
      
      h = (h < 10) ? "0" + h : h;
      m = (m < 10) ? "0" + m : m;
      s = (s < 10) ? "0" + s : s;
      
      var time = h + ":" + m + ":" + s + " " + session;
      document.getElementById("time").innerText = time;
      document.getElementById("time").textContent = time;
      
      setTimeout(showTime, 1000);
      
  }
   
  showTime();



  //toast

  const toast = document.getElementById("toast");

  