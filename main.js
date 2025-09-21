/*************** CONFIG: map cột CSV ***************/
const CONFIG = {
  DATA_FILE: "data.csv",
  COLS: {
    datetime:    "Thời gian tạo đơn",
    order_id:    "Mã đơn hàng",
    customer_id: "Mã khách hàng",
    item_code:   "Mã mặt hàng",
    item_name:   "Tên mặt hàng",
    group_code:  "Mã nhóm hàng",
    group_name:  "Tên nhóm hàng",
    qty:         "SL",
    amount_vnd:  "Thành tiền",
  },
  PALETTE: {
    "[BOT] Bột": "#3f6aa1",
    "[SET] Set trà": "#f29d38",
    "[THO] Trà hoa": "#e86b74",
    "[TMX] Trà mix": "#74c1c4",
    "[TTC] Trà củ, quả sấy": "#71b36b"
  }
};
/**************** END CONFIG ****************/

// ====== Helpers/UI ======
const fmtM   = v => `${Math.round(v/1e6)}M`;
const fmtVND = v => `${Math.round(v/1e6).toLocaleString("vi-VN")} triệu VND`;
const title  = d3.select("#title");
const legendWrap = d3.select("#legend");
const chartWrap  = d3.select("#chart");
const tabsWrap   = d3.select("#quarter-tabs");
const tip = d3.select("body").append("div").attr("class","tooltip").style("opacity",0);

const QUARTERS = Array.from({ length: 12 }, (_, i) => `Q${i + 1}`);

function buildTabs() {
  tabsWrap.selectAll("button")
    .data(QUARTERS)
    .join("button")
    .attr("class", d => `tab`)
    .attr("data-q", d => d)
    .text(d => d)
    .on("click", (e, q) => {
      e.preventDefault();
      location.hash = q;   // điều hướng bằng hash
    });
}
function setActiveTab(q) { tabsWrap.selectAll(".tab").classed("active", d => d === q); }

function colorScale(groups){
  const fb = d3.schemeTableau10;
  return d3.scaleOrdinal().domain(groups)
    .range(groups.map((g,i)=>CONFIG.PALETTE[g] || fb[i%fb.length]));
}
function renderLegend(groups, color){
  legendWrap.selectAll("*").remove();
  const li = legendWrap.selectAll(".legend-item").data(groups).join("div").attr("class","legend-item");
  li.append("span").attr("class","legend-swatch").style("background", d=>color(d));
  li.append("span").text(d=>d);
}
function makeSvg(w,h){ chartWrap.selectAll("*").remove(); return chartWrap.append("svg").attr("width",w).attr("height",h); }
function makeGrid(){ chartWrap.selectAll("*").remove(); return chartWrap.append("div").attr("class","small-multi"); }
function showTip(ev, lines){ tip.style("opacity",1).html(lines.join("<br>")).style("left",(ev.clientX+14)+"px").style("top",(ev.clientY+14)+"px"); }
function hideTip(){ tip.style("opacity",0); }

// ====== Load CSV & prepare ======
d3.csv(CONFIG.DATA_FILE, d3.autoType).then(raw => {
  const C = CONFIG.COLS;
  const weekdayNames = ["Chủ Nhật","Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy"];

  const data = raw.map(r=>{
    const dt = new Date(r[C.datetime]);
    const goodDate = dt instanceof Date && !isNaN(dt);
    const month = goodDate ? dt.getMonth()+1 : null;
    const day   = goodDate ? dt.getDate() : null;
    const hour  = goodDate ? dt.getHours() : 0;
    const wk    = goodDate ? weekdayNames[dt.getDay()] : null;
    const hourBin = `${String(hour).padStart(2,"0")}:00-${String(hour).padStart(2,"0")}:59`;

    const group = `[${(r[C.group_code]||"").trim()}] ${(r[C.group_name]||"").trim()}`;
    const item  = `[${(r[C.item_code]||"").trim()}] ${(r[C.item_name]||"").trim()}`;

    return {
      dt, month, day, weekday: wk, hour, hour_bin: hourBin,
      order_id: String(r[C.order_id]||"").trim(),
      customer_id: String(r[C.customer_id]||"").trim(),
      item, group,
      qty: +r[C.qty] || 0,
      amount: +r[C.amount_vnd] || 0
    };
  });

  const groups = Array.from(new Set(data.map(d=>d.group))).filter(Boolean);
  const color  = colorScale(groups);

  buildTabs();
  window.addEventListener("hashchange", activateFromHash);
  activateFromHash();

  function activateFromHash(){
    const q = (location.hash || "#Q1").slice(1).toUpperCase();
    setActiveTab(q);
    setTitle(q);
    if (["Q1","Q2","Q7","Q8","Q9","Q10"].includes(q)) renderLegend(groups, color);
    else legendWrap.selectAll("*").remove();
    ({
      Q1: renderQ1, Q2: renderQ2, Q3: renderQ3, Q4: renderQ4, Q5: renderQ5, Q6: renderQ6,
      Q7: renderQ7, Q8: renderQ8, Q9: renderQ9, Q10: renderQ10, Q11: renderQ11, Q12: renderQ12
    }[q])();
  }

  function setTitle(q){
    const t = {
      Q1:"Doanh số bán hàng theo Mặt hàng",
      Q2:"Doanh số bán hàng theo Nhóm hàng",
      Q3:"Doanh số bán hàng theo Tháng",
      Q4:"Doanh số bán hàng trung bình theo Ngày trong tuần",
      Q5:"Doanh số bán hàng trung bình theo Ngày trong tháng",
      Q6:"Doanh số bán hàng trung bình theo Khung giờ",
      Q7:"Xác suất bán hàng theo Nhóm hàng",
      Q8:"Xác suất bán hàng của Nhóm hàng theo Tháng",
      Q9:"Xác suất bán hàng của Mặt hàng theo Nhóm hàng",
      Q10:"Xác suất bán hàng của Mặt hàng theo Nhóm hàng trong từng Tháng",
      Q11:"Phân phối Lượt mua hàng",
      Q12:"Phân phối Mức chi trả của Khách hàng",
    }[q];
    title.text(`${t} — ${q}`);
  }

  // ---------- Q1 ----------
  function renderQ1(){
    const width = Math.max(1500, 1300);
    const margin = {top:10, right:60, bottom:40, left:260};
    const rows = d3.rollups(data, v=>d3.sum(v,d=>d.amount), d=>d.item, d=>d.group)
      .map(([item, byGroup])=>{
        const group = byGroup.sort((a,b)=>d3.descending(a[1],b[1]))[0][0];
        return { item, group, value: d3.sum(byGroup, d=>d[1]) };
      })
      .sort((a,b)=>d3.descending(a.value,b.value)).slice(0,18);

    const height = Math.max(360, margin.top+margin.bottom + rows.length*26);
    const svg = makeSvg(width,height), g=svg.append("g");
    const x = d3.scaleLinear().domain([0,d3.max(rows,d=>d.value)||1]).nice().range([margin.left,width-margin.right]);
    const y = d3.scaleBand().domain(rows.map(d=>d.item)).range([margin.top,height-margin.bottom]).padding(.2);

    g.append("g").attr("transform",`translate(0,${height-margin.bottom})`)
      .call(d3.axisBottom(x).ticks(12).tickSize(-(height-margin.top-margin.bottom)).tickFormat(""))
      .selectAll("line").attr("stroke","#eee");
    g.append("g").attr("transform",`translate(0,${height-margin.bottom})`).call(d3.axisBottom(x).ticks(12).tickFormat(fmtM));
    g.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(y));

    g.selectAll("rect").data(rows).join("rect")
      .attr("x",x(0)).attr("y",d=>y(d.item)).attr("height",y.bandwidth())
      .attr("width",d=>x(d.value)-x(0)).attr("fill", d=>color(d.group))
      .on("mousemove",(ev,d)=>showTip(ev,[`<b>${d.item}</b>`,`Nhóm hàng: ${d.group}`,`Doanh số: ${fmtVND(d.value)}`]))
      .on("mouseleave", hideTip);

    g.selectAll(".lbl").data(rows).join("text").attr("class","lbl")
      .attr("x", d=>x(d.value)+4).attr("y", d=>y(d.item)+y.bandwidth()/2).attr("dy",".35em").style("font-size","12px")
      .text(d=>fmtVND(d.value));
  }
 // ---------- Q2 ----------
  function renderQ2(){
    const width = Math.max(1500, 1300);
    const margin = {top:10, right:60, bottom:40, left:260};
    const rows = d3.rollups(data, v=>d3.sum(v,d=>d.amount), d=>d.group)
      .map(([group, value])=>({group,value}))
      .sort((a,b)=>d3.descending(a.value,b.value));
    const height = margin.top+margin.bottom + rows.length*50;
    const svg=makeSvg(width,height), g=svg.append("g");

    const x=d3.scaleLinear().domain([0,d3.max(rows,d=>d.value)||1]).nice().range([margin.left,width-margin.right]);
    const y=d3.scaleBand().domain(rows.map(d=>d.group)).range([margin.top,height-margin.bottom]).padding(.2);

    g.append("g").attr("transform",`translate(0,${height-margin.bottom})`)
      .call(d3.axisBottom(x).ticks(18).tickSize(-(height-margin.top-margin.bottom)).tickFormat(""))
      .selectAll("line").attr("stroke","#eee");
    g.append("g").attr("transform",`translate(0,${height-margin.bottom})`).call(d3.axisBottom(x).ticks(18).tickFormat(fmtM));
    g.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(y));

    g.selectAll("rect").data(rows).join("rect")
      .attr("x",x(0)).attr("y",d=>y(d.group)).attr("height",y.bandwidth())
      .attr("width",d=>x(d.value)-x(0)).attr("fill", d=>color(d.group));

    g.selectAll(".lbl").data(rows).join("text").attr("class","lbl")
      .attr("x", d=>x(d.value)+4).attr("y", d=>y(d.group)+y.bandwidth()/2).attr("dy",".35em")
      .text(d=>fmtVND(d.value));
  }

  // ---------- Q3 ----------
function renderQ3(){
  const width=1280, height=520, margin={top:10,right:10,bottom:60,left:60};
  const rows = d3.rollups(data, v=>d3.sum(v,d=>d.amount), d=>+d.month)
    .map(([m,val])=>({m,val})).sort((a,b)=>a.m-b.m);
  const svg=makeSvg(width,height), g=svg.append("g");

  const x=d3.scaleBand().domain(rows.map(d=>d.m)).range([margin.left,width-margin.right]).padding(.2);
  const y=d3.scaleLinear().domain([0,d3.max(rows,d=>d.val)||1]).nice().range([height-margin.bottom,margin.top]);

  g.append("g").attr("transform",`translate(0,${height-margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(m=>`Tháng ${String(m).padStart(2,"0")}`));
  g.append("g").attr("transform",`translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(10).tickFormat(fmtM));

  // thêm thang màu cho từng tháng
  const color = d3.scaleOrdinal()
    .domain(rows.map(d=>d.m))
    .range(d3.schemeTableau10.concat(d3.schemeSet3)); // bộ màu đa dạng

  g.selectAll("rect").data(rows).join("rect")
    .attr("x",d=>x(d.m))
    .attr("y",d=>y(d.val))
    .attr("width",x.bandwidth())
    .attr("height",d=>y(0)-y(d.val))
    .attr("fill",d=>color(d.m))
    .on("mousemove",(ev,d)=>showTip(ev,[`<b>Tháng ${String(d.m).padStart(2,"0")}</b>`,`Doanh số: ${fmtVND(d.val)}`]))
    .on("mouseleave", hideTip);

  g.selectAll(".lbl").data(rows).join("text").attr("class","lbl")
    .attr("x", d=>x(d.m)+x.bandwidth()/2)
    .attr("y", d=>y(d.val)-6)
    .attr("text-anchor","middle")
    .text(d=>fmtVND(d.val));
}


  // ---------- Q4 ----------
function renderQ4(){
  const fmtM   = v => `${(v/1e6).toLocaleString("vi-VN",{maximumFractionDigits:2})}M`;
  const fmtVND = v => `${Math.round(v).toLocaleString("vi-VN")} VND`;
  const width = 1280, height = 440, margin = {top: 10, right: 16, bottom: 56, left: 80};
  const order = ["Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy","Chủ Nhật"];


  // 1) Tổng doanh số theo từng NGÀY (yyyy-mm-dd)
  const daily = d3.rollups(
    data.filter(d=>d.dt),
    v => d3.sum(v, d => d.amount),
    d => d.dt.toISOString().slice(0,10) // ngày
  ).map(([dayKey, sum]) => {
    const dt = new Date(dayKey);
    const wname = ["Chủ Nhật","Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy"][dt.getDay()];
    return { dayKey, wname, sum };
  });


  // 2) Trung bình doanh số/ngày theo THỨ
  const rows = d3.rollups(daily, v => d3.mean(v, d => d.sum), d => d.wname)
    .map(([w, avg]) => ({ w, avg }))
    .filter(d => d.w)
    .sort((a,b) => order.indexOf(a.w) - order.indexOf(b.w));


  const svg = makeSvg(width, height).attr("class","q4");
  const g = svg.append("g");


  const x = d3.scaleBand().domain(rows.map(d => d.w))
    .range([margin.left, width - margin.right]).padding(0.2);


  const y = d3.scaleLinear()
    .domain([0, d3.max(rows, d => d.avg) || 1]).nice()
    .range([height - margin.bottom, margin.top]);


  // trục
  g.append("g").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x));
  g.append("g").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(8).tickSize(-(width - margin.left - margin.right)).tickFormat(""))
    .selectAll("line").attr("stroke","#e5e5e5");
  g.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(8).tickFormat(fmtM));


  const palette = ["#4C78A8","#F58518","#E45756","#72B7B2","#54A24B","#EEC14B","#B279A2"];
  const color = d3.scaleOrdinal().domain(order).range(palette);


  // cột
  g.selectAll("rect").data(rows).join("rect")
    .attr("x", d => x(d.w))
    .attr("y", d => y(d.avg))
    .attr("width", x.bandwidth())
    .attr("height", d => y(0) - y(d.avg))
    .attr("rx",4).attr("ry",4)
    .attr("fill", d => color(d.w))
    .on("mousemove",(ev,d)=>showTip(ev,[`<b>${d.w}</b>`,`Doanh số bán TB: ${fmtVND(d.avg)}`]))
    .on("mouseleave", hideTip);


  // nhãn
  g.selectAll(".lbl").data(rows).join("text").attr("class","lbl")
    .attr("x", d => x(d.w) + x.bandwidth()/2)
    .attr("y", d => y(d.avg) - 6)
    .attr("text-anchor","middle")
    .style("font-weight",600)
    .text(d => fmtVND(d.avg));
}



// ---------- Q5 ----------
function renderQ5(){
  // --- Formatter: triệu, 1 chữ số thập phân ---
  const fmtM   = v => `${(v/1e6).toLocaleString("vi-VN",{minimumFractionDigits:1, maximumFractionDigits:1})}M`;
  const fmtVND = v => `${(v/1e6).toLocaleString("vi-VN",{minimumFractionDigits:1, maximumFractionDigits:1})} tr VND`;

  const width  = Math.max(1300, (chartWrap.node()?.clientWidth || 1280));
  const height = 600;
  const margin = {top: 28, right: 20, bottom: 80, left: 80};   

  // 1) Tổng doanh số theo từng NGÀY
  const daily = d3.rollups(
    data.filter(d=>d.dt && d.day!=null),
    v => d3.sum(v, d => d.amount),
    d => d.dt.toISOString().slice(0,10)
  ).map(([dayKey, sum]) => {
    const dt = new Date(dayKey);
    return { day: dt.getDate(), sum };
  });

  // 2) Trung bình theo NGÀY TRONG THÁNG
  const rows = d3.rollups(daily, v => d3.mean(v, d => d.sum), d => d.day)
    .map(([day, avg]) => ({ day:+day, avg }))
    .sort((a,b)=>a.day-b.day);

  const svg=makeSvg(width,height), g=svg.append("g");

  const x=d3.scaleBand().domain(rows.map(d=>d.day))
    .range([margin.left,width-margin.right])
    .padding(0.18); // tăng khoảng cách cột một chút

  const y=d3.scaleLinear()
    .domain([0,d3.max(rows,d=>d.avg)||1]).nice()
    .range([height-margin.bottom,margin.top]);

  // Trục
  g.append("g")
    .attr("transform",`translate(0,${height-margin.bottom})`)
    .call(d3.axisBottom(x).tickValues(x.domain()))               
    .selectAll("text")
      .attr("font-size","12px");

  g.append("g")
    .attr("transform",`translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(10).tickFormat(fmtM));

  // Cột
  g.selectAll("rect").data(rows).join("rect")
    .attr("x",d=>x(d.day)).attr("y",d=>y(d.avg)).attr("width",x.bandwidth())
    .attr("height",d=>y(0)-y(d.avg))
    .attr("fill",(d,i)=>d3.schemeTableau10.concat(d3.schemeSet3)[i% (10+12)])
    .on("mousemove",(ev,d)=>showTip(ev,[`<b>Ngày ${d.day}</b>`,`Doanh số bán TB: ${fmtVND(d.avg)}`]))
    .on("mouseleave", hideTip);

  // Nhãn giá trị (nhỏ hơn + chừa khoảng)
  g.selectAll(".lbl").data(rows).join("text").attr("class","lbl")
    .attr("x", d=>x(d.day)+x.bandwidth()/2)
    .attr("y", d=>y(d.avg)-8)
    .attr("text-anchor","middle")
    .attr("font-size","12px")
    .attr("font-weight","600")
    .text(d=>fmtVND(d.avg));
}

  // ---------- Q6 ----------
function renderQ6(){
  const width=1400, height=400, margin={top:10,right:10,bottom:60,left:70};
  const fmtVND_full = v => `${Math.round(v).toLocaleString("vi-VN")} VND`;

  // 1) Tổng doanh số theo từng (NGÀY + GIỜ)
  const dayHour = d3.rollups(
    data.filter(d=>d.dt!=null),
    v => d3.sum(v, d => d.amount),
    d => `${d.dt.toISOString().slice(0,10)} ${String(d.hour).padStart(2,"0")}`
  ).map(([key,sum])=>{
    const hh = +key.slice(11,13);
    const bin = `${String(hh).padStart(2,"0")}:00-${String(hh).padStart(2,"0")}:59`;
    return { hour: hh, bin, sum };
  });

  // 2) Trung bình doanh số/giờ qua các ngày
  const rows = d3.rollups(dayHour, v => d3.mean(v, d => d.sum), d => d.bin)
    .map(([bin,avg]) => ({ bin, avg }))
    .sort((a,b)=>+a.bin.slice(0,2)-+b.bin.slice(0,2));

  const svg=makeSvg(width,height), g=svg.append("g");
  const x=d3.scaleBand().domain(rows.map(d=>d.bin)).range([margin.left,width-margin.right]).padding(.1);
  const y=d3.scaleLinear().domain([0,d3.max(rows,d=>d.avg)||1]).nice()
            .range([height-margin.bottom,margin.top]);

  g.append("g").attr("transform",`translate(0,${height-margin.bottom})`).call(d3.axisBottom(x));

  // Trục Y: VND đầy đủ 
  g.append("g").attr("transform",`translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(8).tickFormat(v => Math.round(v).toLocaleString("vi-VN")));

  g.selectAll("rect").data(rows).join("rect")
    .attr("x",d=>x(d.bin)).attr("y",d=>y(d.avg)).attr("width",x.bandwidth())
    .attr("height",d=>y(0)-y(d.avg)).attr("fill",(d,i)=>d3.schemeTableau10[i%10])
    .on("mousemove",(ev,d)=>showTip(ev,[
      `<b>${d.bin}</b>`,
      `Doanh số bán TB: ${fmtVND_full(d.avg)}`
    ]))
    .on("mouseleave", hideTip);

  g.selectAll(".lbl").data(rows).join("text").attr("class","lbl")
    .attr("x", d=>x(d.bin)+x.bandwidth()/2).attr("y", d=>y(d.avg)-6)
    .attr("text-anchor","middle")
    .text(d=>fmtVND_full(d.avg));
}


  // ---------- Q7 ----------
function renderQ7(){
  const totalOrders = new Set(data.map(d => d.order_id)).size || 1;
  const rows = d3.rollups(
      data,
      v => new Set(v.map(d => d.order_id)).size,  // COUNTD(order_id) theo nhóm
      d => d.group
    )
    .map(([group, cnt]) => ({ group, cnt, p: cnt / totalOrders }))
    .sort((a,b) => d3.descending(a.p, b.p));

  // 3) Vẽ bar chart ngang
  const width  = Math.max(1400, (chartWrap.node()?.clientWidth || 1200));
  const margin = { top: 20, right: 60, bottom: 40, left: 280 };
  const height = margin.top + margin.bottom + rows.length * 56;
  const svg = makeSvg(width, height), g = svg.append("g");
  const groups = rows.map(d => d.group);
  const color  = colorScale(groups);
  const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
  const y = d3.scaleBand().domain(groups).range([margin.top, height - margin.bottom]).padding(0.25);

  // Trục + grid
  g.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format(".0%")));
  g.append("g").attr("transform", `translate(0,0)`)
    .call(d3.axisBottom(x).ticks(10).tickSize(-(height - margin.top - margin.bottom)).tickFormat(""))
    .selectAll("line").attr("stroke", "#eee");

  const yAxis = g.append("g").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickSize(0));
  yAxis.selectAll("text").attr("font-size","13px").attr("dy","0.35em");

  // Cột
  g.selectAll("rect").data(rows).join("rect")
    .attr("x", x(0)).attr("y", d => y(d.group)).attr("height", y.bandwidth())
    .attr("width", d => x(d.p) - x(0))
    .attr("rx", 6).attr("ry", 6)
    .attr("fill", d => color(d.group))
    .on("mousemove",(ev,d)=>showTip(ev,[
      `<b>${d.group}</b>`,
      `Xác suất bán: ${d3.format(".1%")(d.p)}`
    ]))
    .on("mouseleave", hideTip);

  // Nhãn %
  g.selectAll(".lbl").data(rows).join("text").attr("class","lbl")
    .attr("x", d => x(d.p) + 6)
    .attr("y", d => y(d.group) + y.bandwidth()/2)
    .attr("dy", "0.35em").attr("font-weight", 600)
    .text(d => d3.format(".1%")(d.p));
}



  // ---------- Q8 ----------
function renderQ8(){
  const months = Array.from(new Set(data.map(d=>+d.month))).sort((a,b)=>a-b);
  const groups = Array.from(new Set(data.map(d=>d.group))).filter(Boolean).sort(d3.ascending);
  const color  = colorScale(groups);

  // COUNTD(order_id) theo (tháng, nhóm)
  const cntMonthGroup = d3.rollups(
    data,
    v => new Set(v.map(d => d.order_id)).size,
    d => +d.month,     // tháng
    d => d.group       // nhóm
  );

  const mapMonthGroup = new Map(
    cntMonthGroup.map(([m, arr]) => [m, new Map(arr)])
  );
  const cntMonth = new Map(
    d3.rollups(
      data,
      v => new Set(v.map(d => d.order_id)).size,
      d => +d.month
    ) // ==> [ [m, totalCnt], ... ]
  );

  // Tạo series cho từng nhóm: giá trị là % theo tháng
  const series = groups.map(g => ({
    key: g,
    values: months.map(m => {
      const numer = mapMonthGroup.get(m)?.get(g) || 0; 
      const denom = cntMonth.get(m) || 1;              
      return { m, cnt: numer, p: numer / denom };
    })
  }));

  // Vẽ
  const width=1280, height=520, margin={top:10,right:160,bottom:50,left:60};
  const svg=makeSvg(width,height), g=svg.append("g");

  const x=d3.scalePoint().domain(months).range([margin.left,width-margin.right]).padding(0.5);
  const y=d3.scaleLinear()
            .domain([0, Math.min(1, d3.max(series.flatMap(s=>s.values.map(v=>v.p))) || 1)])
            .nice()
            .range([height-margin.bottom,margin.top]);

  g.append("g").attr("transform",`translate(0,${height-margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(m=>`Tháng ${String(m).padStart(2,"0")}`));

  g.append("g").attr("transform",`translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(8).tickFormat(d3.format(".0%")));

  const line=d3.line().x(d=>x(d.m)).y(d=>y(d.p));

  // Đường
  g.selectAll("path.series").data(series).join("path")
    .attr("class","series").attr("fill","none").attr("stroke-width",2)
    .attr("stroke", s=>color(s.key)).attr("d", s=>line(s.values));

  // Điểm + tooltip
  series.forEach(s => {
    g.selectAll(`circle.pt-${s.key}`).data(s.values).join("circle")
      .attr("class",`pt-${s.key}`)
      .attr("cx", d=>x(d.m)).attr("cy", d=>y(d.p)).attr("r",3.5)
      .attr("fill", color(s.key))
      .on("mousemove",(ev,d)=>showTip(ev,[
        `<b>Tháng ${String(d.m).padStart(2,"0")}</b> | Nhóm hàng <b>${s.key}</b>`,
        `SL Đơn Bán: ${d.cnt.toLocaleString("vi-VN")}`,
        `Xác suất Bán: ${d3.format(".1%")(d.p)}`
      ]))
      .on("mouseleave", hideTip);
  });

  // Legend đơn giản (bên phải)
  const legend = svg.append("g").attr("transform",`translate(${width - margin.right + 10}, ${margin.top})`);
  const li = legend.selectAll("g").data(groups).join("g").attr("transform",(d,i)=>`translate(0,${i*20})`);
  li.append("rect").attr("width",12).attr("height",12).attr("fill",d=>color(d)).attr("rx",2);
  li.append("text").attr("x",16).attr("y",10).attr("font-size","12px").text(d=>d);
}


  // ---------- Q9 ----------
function renderQ9(){
  // Container dạng lưới: 3 ô hàng đầu, 2 ô hàng dưới
  const container = makeGrid().attr("class","q9-grid")
    .style("display","grid")
    .style("grid-template-columns","repeat(3, minmax(0,1fr))")
    .style("gap","24px");

  // Tách theo nhóm
  const groups = d3.rollups(data, v=>v, d=>d.group)
                   .sort((a,b)=>d3.ascending(a[0], b[0])); // ổn định thứ tự

  groups.forEach(([gname, rows], idx) => {
    const card = container.append("div").attr("class","card");
    // để 2 ô dưới cùng hiển thị giống ảnh (cột 1–2), cứ để ô thứ 5 rơi vào cột 2 là được
    if (idx >= 3) card.style("grid-column","span 1"); // 2 ô cuối ở hàng 2

   
    card.append("h3")
      .text(gname)
      .style("margin","4px 0 8px")
      .style("font-size","12px")
      .style("color","#1f7a8c")
      .style("text-align","center");

   
    const totalOrdersInGroup = new Set(rows.map(d => d.order_id)).size || 1;

    
    const itemCnt = d3.rollups(
      rows,
      v => new Set(v.map(d => d.order_id)).size,
      d => d.item
    )
    .map(([item, cnt]) => ({ item, cnt, p: cnt / totalOrdersInGroup }))
    .sort((a,b) => d3.descending(a.p, b.p))
    

    // Vẽ 1 chart ngang cho nhóm
    const width  = 520;
    const margin = { top: 6, right: 48, bottom: 36, left: 200 };
    const height = margin.top + margin.bottom + itemCnt.length * 36;

    const svg = card.append("svg").attr("width", width).attr("height", height);
    const x = d3.scaleLinear().domain([0, d3.max(itemCnt, d => d.p) || 1])
                 .range([margin.left, width - margin.right]);
    const y = d3.scaleBand().domain(itemCnt.map(d => d.item))
                 .range([margin.top, height - margin.bottom]).padding(0.2);

    // Trục dưới (phần trăm) + grid dọc nhạt
    svg.append("g").attr("transform",`translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format(".0%")));
    svg.append("g").attr("transform","translate(0,0)")
      .call(d3.axisBottom(x).ticks(6).tickSize(-(height - margin.top - margin.bottom)).tickFormat(""))
      .selectAll("line").attr("stroke","#eee");

    // Trục trái (tên mặt hàng)
    svg.append("g").attr("transform",`translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickSize(0))
      .selectAll("text").attr("font-size","11px");

    // Palette theo item trong nhóm (giống dạng Tableau – mỗi thanh 1 màu)
    const palette = d3.schemeTableau10.concat(d3.schemeSet3);
    const color   = d3.scaleOrdinal().domain(itemCnt.map(d=>d.item)).range(palette);

    // Thanh ngang
    svg.selectAll("rect").data(itemCnt).join("rect")
      .attr("x", x(0))
      .attr("y", d => y(d.item))
      .attr("height", y.bandwidth())
      .attr("width", d => x(d.p) - x(0))
      .attr("rx", 6).attr("ry", 6)
      .attr("fill", d => color(d.item))
      .on("mousemove",(ev,d)=>showTip(ev,[
        `<b>${gname}</b>`,
        d.item,
        `Số đơn: ${d.cnt.toLocaleString("vi-VN")} `,
        `Tỷ lệ: ${d3.format(".1%")(d.p)}`
      ]))
      .on("mouseleave", hideTip);

    // Nhãn % bên phải
    svg.selectAll(".lbl").data(itemCnt).join("text").attr("class","lbl")
      .attr("x", d => x(d.p) + 6)
      .attr("y", d => y(d.item) + y.bandwidth()/2)
      .attr("dy",".35em")
      .attr("font-weight",600)
      .attr("font-size","11px")
      .text(d => d3.format(".1%")(d.p));
  });
}

  // ---------- Q10 ----------
// ---------- Q10 ----------
function renderQ10(){
  // 5 chart: 3 trên - 2 dưới. Bột = 1 đường thẳng 100%
  const container = makeGrid()
    .style("display","grid")
    .style("grid-template-columns","repeat(3, minmax(0,1fr))")
    .style("gap","24px");

  // Tháng có trong dữ liệu (đã có sẵn field d.month ở pipeline đầu file)
  const months = Array.from(new Set(data.map(d=>+d.month))).sort((a,b)=>a-b);

  // Thứ tự nhóm hiển thị đúng yêu cầu
  const groupOrder = [
    "[SET] Set trà",
    "[THO] Trà hoa",
    "[TMX] Trà mix",
    "[TTC] Trà củ, quả sấy",
    "[BOT] Bột"
  ].filter(g => data.some(d => d.group === g));

  // Gom dữ liệu theo group trước
  const byGroup = d3.rollups(data, v=>v, d=>d.group)
                    .reduce((m,[g,rows])=>m.set(g, rows), new Map());

  // Helper: build series tỉ trọng theo tháng cho 1 group (top-6 item)
  function buildSeries(rows, topK=6){
    // mẫu số = COUNTD(order_id) theo tháng trong group
    const totalByMonth = d3.rollups(
      rows, v=>new Set(v.map(d=>d.order_id)).size, d=>+d.month
    ).reduce((m,[mth,c])=>m.set(+mth, c), new Map());

    // tử số cho từng item theo tháng
    const itemMonthCnt = d3.rollups(
      rows, v=>new Set(v.map(d=>d.order_id)).size, d=>d.item, d=>+d.month
    );

    // chọn topK item theo tổng số đơn toàn kỳ để bớt rối
    const topItems = itemMonthCnt
      .map(([item, arr]) => [item, d3.sum(arr, d=>d[1])])
      .sort((a,b)=>d3.descending(a[1],b[1]))
      .slice(0, topK)
      .map(d=>d[0]);

    return itemMonthCnt
      .filter(([item]) => topItems.includes(item))
      .map(([item, arr])=>{
        const m = new Map(arr); // month -> cnt
        return {
          key: item,
          values: months.map(mm=>{
            const numer = m.get(mm) || 0;
            const denom = totalByMonth.get(mm) || 1;
            return { m: mm, p: numer/denom };
          })
        };
      });
  }

  // Helper: vẽ 1 card
  function drawCard(title, rows, opts={}){
    const card = container.append("div").attr("class","card");
    card.append("h3").text(title)
      .style("margin","4px 0 8px")
      .style("font-size","12px")
      .style("text-align","center");

    const width=560, height=250, margin={top:12,right:16,bottom:40,left:56};
    const svg = card.append("svg").attr("width",width).attr("height",height);
    const g   = svg.append("g");

    const x = d3.scalePoint().domain(months)
                .range([margin.left, width-margin.right]).padding(0.5);
    const xAxis = d3.axisBottom(x).tickFormat(m=>`T${String(m).padStart(2,"0")}`);

    // Trường hợp [BOT] Bột: 1 đường phẳng 100%
    if (opts.flat100){
      const y = d3.scaleLinear().domain([0.9,1.1]).range([height-margin.bottom, margin.top]);
      const yAxis = d3.axisLeft(y).tickValues([0.9,1.0,1.1]).tickFormat(d3.format(".0%"));

      g.append("g").attr("transform",`translate(0,${height-margin.bottom})`).call(xAxis);
      g.append("g").attr("transform",`translate(${margin.left},0)`).call(yAxis);

      const line = d3.line().x(d=>x(d.m)).y(d=>y(d.p));
      const constant = months.map(m=>({m, p:1}));
      const stroke = CONFIG.PALETTE?.["[BOT] Bột"] || "#9aa0a6";
      g.append("path").attr("fill","none").attr("stroke-width",2).attr("stroke",stroke)
        .attr("d", line(constant));
      return;
    }

    // Chart thường (top-6 item)
    const series = buildSeries(rows, 6);
    if (series.length===0){
      card.append("div").style("padding","8px").text("Không có dữ liệu");
      return;
    }

    const allP = series.flatMap(s=>s.values.map(v=>v.p));
    const y = d3.scaleLinear()
      .domain([Math.max(0, d3.min(allP)-0.02), Math.min(1, d3.max(allP)+0.02)]).nice()
      .range([height-margin.bottom, margin.top]);
    const yAxis = d3.axisLeft(y).ticks(5).tickFormat(d3.format(".0%"));

    g.append("g").attr("transform",`translate(0,${height-margin.bottom})`).call(xAxis);
    g.append("g").attr("transform",`translate(${margin.left},0)`).call(yAxis);

    const color = d3.scaleOrdinal()
      .domain(series.map(s=>s.key))
      .range(series.map((s,i)=>CONFIG.PALETTE?.[s.key] || d3.schemeTableau10[i%10]));

    const line = d3.line().x(d=>x(d.m)).y(d=>y(d.p));

    g.selectAll("path.series").data(series).join("path")
      .attr("class","series").attr("fill","none").attr("stroke-width",2)
      .attr("stroke", s=>color(s.key)).attr("d", s=>line(s.values));
  }

  // Vẽ theo thứ tự 5 nhóm
  groupOrder.forEach(gname=>{
    if (gname === "[BOT] Bột") drawCard(gname, [], {flat100:true});
    else drawCard(gname, byGroup.get(gname) || []);
  });
}



  // ---------- Q11 ----------
  function renderQ11(){
    const ordersByCust = d3.rollups(data, v=>new Set(v.map(d=>d.order_id)).size, d=>d.customer_id)
      .map(([cid, cnt])=>({cid, cnt}));

    const maxCnt = d3.max(ordersByCust, d=>d.cnt) || 1;
    const bins = d3.range(1, maxCnt+1);
    const freq = bins.map(k => ({k, n: ordersByCust.filter(d=>d.cnt===k).length}));

    const width=1280, height=520, margin={top:10,right:20,bottom:50,left:60};
    const svg=makeSvg(width,height), g=svg.append("g");

    const x=d3.scaleBand().domain(freq.map(d=>d.k)).range([margin.left,width-margin.right]).padding(.15);
    const y=d3.scaleLinear().domain([0, d3.max(freq,d=>d.n)||1]).nice().range([height-margin.bottom,margin.top]);

    g.append("g").attr("transform",`translate(0,${height-margin.bottom})`).call(d3.axisBottom(x));
    g.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(y));

    g.selectAll("rect").data(freq).join("rect")
      .attr("x",d=>x(d.k)).attr("y",d=>y(d.n)).attr("width",x.bandwidth())
      .attr("height",d=>y(0)-y(d.n)).attr("fill","#3f6aa1")
      .on("mousemove",(ev,d)=>showTip(ev,[`<b>${d.n.toLocaleString("vi-VN")}</b> khách có <b>${d.k}</b> lượt mua`]))
      .on("mouseleave", hideTip);
  }

  // ---------- Q12 ----------
  function renderQ12(){
    const spendByCust = d3.rollups(data, v=>d3.sum(v,d=>d.amount), d=>d.customer_id)
      .map(([cid, sum])=>({cid, sum}));

    const maxSpend = d3.max(spendByCust,d=>d.sum)||0;
    const step = 50000; // 50K
    const bins = d3.range(0, Math.ceil(maxSpend/step)*step + step, step);

    const freq = bins.map((b,i)=>{
      const lo=b, hi=b+step;
      const n = spendByCust.filter(d=>d.sum>=lo && d.sum<hi).length;
      return {label: `${(lo/1000)|0}K`, n};
    });

    const width=1280, height=520, margin={top:10,right:20,bottom:120,left:60};
    const svg=makeSvg(width,height), g=svg.append("g");

    const x=d3.scaleBand().domain(freq.map(d=>d.label)).range([margin.left,width-margin.right]).padding(.1);
    const y=d3.scaleLinear().domain([0, d3.max(freq,d=>d.n)||1]).nice().range([height-margin.bottom,margin.top]);

    g.append("g").attr("transform",`translate(0,${height-margin.bottom})`)
      .call(d3.axisBottom(x)).selectAll("text")
      .attr("transform","rotate(90)").attr("text-anchor","start").attr("dx","0.6em").attr("dy","-0.2em");
    g.append("g").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(y));

    g.selectAll("rect").data(freq).join("rect")
      .attr("x",d=>x(d.label)).attr("y",d=>y(d.n)).attr("width",x.bandwidth())
      .attr("height",d=>y(0)-y(d.n)).attr("fill","#3f6aa1")
      .on("mousemove",(ev,d)=>showTip(ev,[`${d.n.toLocaleString("vi-VN")} khách`, `Khoảng: ${d.label}`]))
      .on("mouseleave", hideTip);
  }
});