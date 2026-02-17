window.SHEET = {
  TEAMS_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2NIyT2nQ0ymcFxNTG9qv-YsoQMSs01UPMYdYGVqcprvj5r5y6eA-Fcot73iVVjzM1QU6mUuvk82Kf/pub?gid=0&single=true&output=csv",
  GAMES_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2NIyT2nQ0ymcFxNTG9qv-YsoQMSs01UPMYdYGVqcprvj5r5y6eA-Fcot73iVVjzM1QU6mUuvk82Kf/pub?gid=1880527815&single=true&output=csv",
  ROSTER_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2NIyT2nQ0ymcFxNTG9qv-YsoQMSs01UPMYdYGVqcprvj5r5y6eA-Fcot73iVVjzM1QU6mUuvk82Kf/pub?gid=966740078&single=true&output=csv",
  GALLERY_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2NIyT2nQ0ymcFxNTG9qv-YsoQMSs01UPMYdYGVqcprvj5r5y6eA-Fcot73iVVjzM1QU6mUuvk82Kf/pub?gid=1945229510&single=true&output=csv",
 PLAYOFFS_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2NIyT2nQ0ymcFxNTG9qv-YsoQMSs01UPMYdYGVqcprvj5r5y6eA-Fcot73iVVjzM1QU6mUuvk82Kf/pub?gid=126919836&single=true&output=csv"
};

/**
 * Team branding + coach directory
 * - logo: put team logos in /team-logos/ (recommended), or leave as "./logo.png" for now
 * - coach fields: copy from your Contacts page (Head Coach section)
 *
 * Keys MUST be slugs (lowercase, hyphenated) matching team.html?team=...
 */
window.TEAM_INFO = {
  "westfield-blue": {
    name: "Westfield Blue",
    logo: "./team-logos/westfield-blue.jpg",
    coachName: "Aaron Dalin",
    coachEmail: "aarondalin@gmail.com",
    coachPhone: "(917) 922-9847",
    

  },
  "branchburg": {
    name: "Branchburg",
    logo: "./team-logos/branchburg.png",
    coachName: "Tom Sharples",
    coachEmail: "trsjr12@gmail.com",
    coachPhone: "(908) 361-6332",
   
   
  },
  "ridge": {
    name: "Ridge",
    logo: "./team-logos/ridge.png",
    coachName: "Greg Brunner",
    coachEmail: "gregbrunner@ridgebaseballclub.com",
    coachPhone: "(267) 475-9516",
  
   
  },
  "scotch-plains-fanwood": {
    name: "Scotch Plains Fanwood",
    logo: "./team-logos/scotch-plains-fanwood.png",
    coachName: "Ross Alpert",
    coachEmail: "ross.alpert2@gmail.com",
    coachPhone: "(732) 535-1077",
    
  
  },
  "hillsborough": {
    name: "Hillsborough",
    logo: "./team-logos/hillsborough.png",
    coachName: "Blair Dameron",
    coachEmail: "blaird@hillsboroughbaseball.org",
    coachPhone: "(215) 593-5207",
    
    
  },
  "westfield-white": {
    name: "Westfield White",
    logo: "./team-logos/westfield-blue.jpg",
    coachName: "Danny Lallis",
    coachEmail: "danny.lallis@gmail.com",
    coachPhone: "(898) 698-3012",
   

  },
  "south-orange-maplewood": {
    name: "South Orange Maplewood",
    logo: "./team-logos/south-orange-maplewood.png",
    coachName: "Jeremy Wintroub",
    coachEmail: "jwintroub@gmail.com",
    coachPhone: "(215) 370-8975",
    
    
  },
  "watchung-hills": {
    name: "Watchung Hills",
    logo: "./team-logos/watchung-hills.png",
    coachName: "Steven Freitas",
    coachEmail: "freitas.steven@gmail.com",
    coachPhone: "(201) 744-6063",
   
   
  }
};

// Fallback logo if a team logo is missing
window.DEFAULT_TEAM_LOGO = "./logo.png";


