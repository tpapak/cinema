## CINeMA 

*<span class="fontcinema">CINeMA</span> (Confidence in Network Meta-Analysis) is a web application that simplifies the evaluation of confidence in the findings from network meta-analysis.*

It is based on a methodological framework described in [[1]](https://www.biorxiv.org/content/10.1101/597047v1) which considers six domains: **within-study bias**, **across-studies bias**, **indirectness**,  **imprecision**, **heterogeneity** and **incoherence**.
Key to the <span class="fontcinema">CINeMA</span>'s methodology is the percentage **contribution matrix**, which shows how much information each study contributes to the results from network meta-analysis.

### Contents
- `webapp/` - Web application source code (JavaScript + PureScript)
- `docker/cinema-rserver/` - Backend R server Docker image
- `docker/cinema-web-dev/` - Frontend web server Docker image

### Quick Start

```bash
# Clone and enter webapp directory
git clone https://github.com/tpapak/cinema.git
cd cinema/webapp

# Install dependencies
npm install --legacy-peer-deps
bower install

# Build and run
./build.sh
npx http-server app -p 9000 -c-1
```

Open http://localhost:9000 in your browser.

See [webapp/README.md](webapp/README.md) for detailed build instructions.

### Docker Deployment

```bash
# Frontend
docker run -d -p 80:80 tosku/cinema-web-dev

# Backend R Server
docker run -d -p 8004:8004 tosku/cinema-rserver
```

<sup>CINeMA is licensed under the [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.en.html) license.</sup>
