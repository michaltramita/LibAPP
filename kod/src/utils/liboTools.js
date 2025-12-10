const allowedRoutes = ['/dashboard', '/profile', '/modules', '/settings', '/settings/security'];

function resolveNavigate(route) {
  if (allowedRoutes.some((r) => route.startsWith(r))) {
    return route;
  }
  return '/dashboard';
}

function executeTool({ tool, args = {}, navigate, showGuide }) {
  switch (tool) {
    case 'navigate':
      return navigate(resolveNavigate(args.route));
    case 'openSettings':
      return navigate(resolveNavigate(args.section ? `/settings/${args.section}` : '/settings/security'));
    case 'showGuide':
      return showGuide?.(args.topicId || '');
    case 'searchFeature':
      return args.query ? { result: `Hľadal som: ${args.query}` } : null;
    default:
      return null;
  }
}

export { resolveNavigate, executeTool };

// CommonJS shim for Node tests
if (typeof module !== 'undefined') {
  module.exports = { resolveNavigate, executeTool };
}
