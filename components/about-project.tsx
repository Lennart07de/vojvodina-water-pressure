const external={target:'_blank',rel:'noreferrer'};

export default function AboutProject(){
  return <section id='about' className='about-project' aria-labelledby='about-title'>
    <div className='about-heading'><span className='eyebrow'>OUR PURPOSE & EXPERIENCE</span><h2 id='about-title'>About our project</h2><p>Helping local authorities prepare for water stress in Vojvodina.</p></div>
    <details className='about-content'><summary>Read the project story & development experience</summary>
      <article><h3>Why we chose this challenge</h3>
        <p>Serbia’s experience of summer drought and extreme heat motivated this project. In July 2026, very low Danube levels put pressure on Vojvodina’s water infrastructure. Irrigation was temporarily suspended on parts of the Danube–Tisa–Danube canal network, and an emergency was declared in Sombor, Kula and Vrbas on 29 July. These events illustrate how water stress can affect agriculture, local services and economic activity. <a href='https://www.vodevojvodine.com/2026/07/24/obustavljeno-navodnjavanje-na-pojedinim-deonicama-hs-dtd/' {...external}>Vode Vojvodine, 24 July 2026</a> · <a href='https://vojvodina.gov.rs/vesti/zbog-istori%D1%98ski-niskog-vodosta%D1%98a-dun?id=133772' {...external}>Provincial Government, 29 July 2026</a>.</p>
        <p>Low river levels also disrupted freight transport and tourism along the Danube. On 5 August, Serbia’s government reported difficult navigation conditions and risks to water supply, while noting that navigation through Serbia continued and most of the country had no water-supply restrictions. This distinction matters: impacts vary by place, and decisions need local evidence. <a href='https://www.srbija.gov.rs/vest/en/284539/institutions-monitoring-situation-in-coordinated-manner-implementing-preventive-measures-due-to-heatwave.php' {...external}>Government of Serbia, 5 August 2026</a>.</p>
      </article>
      <article><h3>What we built and who it serves</h3>
        <p>Drought Forecast is a decision-support prototype for municipal teams, water utilities and regional water-management authorities. It brings public weather information into one map so they can identify where closer monitoring may be needed and prepare for possible water stress.</p>
        <p>The map compares seven-day weather-driven irrigation pressure across Vojvodina’s seven districts, with municipality detail appearing when users select a district. A separate timeline provides rainfall and temperature ensemble outlooks from one to 30 days. Recent rainfall is also compared with a 1991–2020 baseline at representative district locations.</p>
        <p>We use published forecasts as inputs; we have not developed or validated a hydrological drought prediction model. Groundwater and reservoir levels are not included because reliable, current local feeds have not been verified. The 30-day outlook is coarser than the municipal map, and neither establishes how much water a municipality has available.</p>
      </article>
      <article><h3>How it could support preparedness</h3>
        <p>Earlier awareness could help authorities review contingency plans, assess potential needs for water tankers, prepare proportionate restriction options and coordinate with neighbouring municipalities. These are possible uses for local review, not automated recommendations to procure supplies or impose restrictions. Any response requires checks of actual supply, infrastructure, demand and legal responsibilities. A lower weather-pressure score does not prove that a neighbouring municipality has spare water to share.</p>
        <p>If testing with local authorities demonstrates value, the approach could be extended to other parts of Serbia. That would require verified local data, suitable boundaries, calibration and evaluation before operational use.</p>
      </article>
      <article className='about-reflection'><span className='eyebrow'>TEAM REFLECTION</span><h3>Development challenges and lessons learned</h3>
        <p>Connecting Codex, GitHub and Vercel proved more time-consuming than we anticipated. Our team spent approximately five hours on the first day configuring access, repository connections and deployment. During development, the usage limits available to our team also interrupted iteration, sometimes requiring waits of around five hours before we could continue. This describes our project experience; it is not a general statement about subscription limits.</p>
        <p>These constraints reduced the time available for design refinement and deeper data integration. With more time and resources, we would prioritise usability testing with municipal users, clearer visual presentation, reliable reservoir and groundwater sources, and validation of the pressure indicator and its thresholds. Our main lesson was to verify the deployment workflow and data availability early, and to distinguish clearly between implemented features and future ambitions.</p>
      </article>
    </details>
  </section>;
}
