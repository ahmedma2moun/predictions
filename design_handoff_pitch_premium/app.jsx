/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard,
   MatchesScreen, MatchDetailScreen, MyScoreScreen, LeaderboardScreen, LoginScreen, HandoffSheet */

function Device({ children }) {
  return (
    <div className="device">
      <div className="notch"></div>
      {children}
      <div className="home-indicator"></div>
    </div>
  );
}

function App() {
  return (
    <DesignCanvas
      title="Preds — Modern UI redesign"
      subtitle="Pitch Premium · dark · 390×844 · ready for Claude Code"
    >
      <DCSection
        id="core"
        title="Core screens"
        subtitle="Drop-in replacements for the existing tabs + auth + match detail"
      >
        <DCArtboard id="login"   label="Login"                  width={390} height={844}><Device><LoginScreen/></Device></DCArtboard>
        <DCArtboard id="matches" label="Matches · upcoming"     width={390} height={844}><Device><MatchesScreen/></Device></DCArtboard>
        <DCArtboard id="detail"  label="Match detail · predict" width={390} height={844}><Device><MatchDetailScreen/></Device></DCArtboard>
        <DCArtboard id="myscore" label="My Score"               width={390} height={844}><Device><MyScoreScreen/></Device></DCArtboard>
        <DCArtboard id="leaders" label="Leaderboard"            width={390} height={844}><Device><LeaderboardScreen/></Device></DCArtboard>
      </DCSection>

      <DCSection
        id="handoff"
        title="Claude Code handoff"
        subtitle="Tokens, components, ship order"
      >
        <DCArtboard id="spec" label="Tokens & components" width={1100} height={920}>
          <HandoffSheet/>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
